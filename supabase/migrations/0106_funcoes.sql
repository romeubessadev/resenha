-- ═══════════════════════════════════════════════════════════════════════════
-- 0106 — Extensões e funções
--
-- As 46 funções do banco — autorização (is_group_member e afins), as RPCs
-- que o app chama e os gatilhos de histórico e push.
--
-- Conjunto ESSENCIAL: reconstruído do schema que está em produção, não da
-- sequência histórica. Sem coluna que nasceu e morreu, sem função redefinida
-- 18 vezes. O porquê de cada decisão está em supabase/migrations_archive/.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Procedência: schema líquido das migrations 0001…0105 (arquivadas)
--
-- Gerado a partir de `pg_dump --schema-only` do projeto remoto (Postgres
-- 17.6), com os MESMOS flags que `supabase db dump` usa. Substitui as 105
-- migrations originais, que ficam arquivadas em supabase/migrations_archive/
-- — é lá que mora o porquê de cada decisão, e nada disso deve ser apagado.
--
-- As três seções no FIM deste arquivo não vieram do pg_dump: os schemas
-- `storage` e `cron` estão na lista `--exclude-schema` do dump, e o que mora
-- neles é LINHA DE TABELA, não DDL. Sem elas, um banco reconstruído a partir
-- daqui sobe sem nenhum bucket (todo upload falha) e sem nenhum agendamento
-- (recorrência para de gerar despesa). Foram lidas do banco vivo, não
-- reconstruídas a partir das migrations.
-- ═══════════════════════════════════════════════════════════════════════════




SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SELECT pg_catalog.set_config('search_path', '', false);

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

CREATE OR REPLACE FUNCTION "public"."add_months_clamped"("p_from" "date", "p_months" integer, "p_anchor_day" integer) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select t.first_day + (
    least(
      coalesce(p_anchor_day, extract(day from p_from)::int),
      extract(day from (t.first_day + interval '1 month' - interval '1 day'))::int
    ) - 1
  )
  from (
    select (date_trunc('month', p_from::timestamp) + make_interval(months => p_months))::date as first_day
  ) t;
$$;

ALTER FUNCTION "public"."add_months_clamped"("p_from" "date", "p_months" integer, "p_anchor_day" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."confirm_settlement"("p_settlement_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settlement public.settlements;
begin
  select * into v_settlement from public.settlements where id = p_settlement_id;
  if not found then
    raise exception 'settlement_not_found';
  end if;

  -- Mesma regra da RLS settlements_update_creditor_confirms — checada de
  -- novo aqui porque security definer não passa pela RLS.
  if v_settlement.to_user <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  if v_settlement.status = 'confirmed' then
    return; -- idempotente — já confirmado, não duplica o payment
  end if;

  update public.settlements
  set status = 'confirmed', confirmed_at = now()
  where id = p_settlement_id;

  insert into public.payments (group_id, from_user, to_user, amount, description)
  values (v_settlement.group_id, v_settlement.from_user, v_settlement.to_user, v_settlement.amount, 'Acerto de contas');
end;
$$;

ALTER FUNCTION "public"."confirm_settlement"("p_settlement_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_expense_with_participants"("p_id" "uuid", "p_group_id" "uuid", "p_title" "text", "p_category_id" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_description" "text" DEFAULT NULL::"text", "p_receipt_path" "text" DEFAULT NULL::"text", "p_recurrence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  -- Repetição da mesma mutação: já está gravada, não há o que fazer. Confere
  -- o grupo junto pra um id que exista em OUTRO rolê não ser tratado como
  -- "já feito" — nesse caso o insert abaixo estoura na chave primária, que é
  -- o comportamento certo.
  if exists (select 1 from public.expenses where id = p_id and group_id = p_group_id) then
    return;
  end if;

  insert into public.expenses (
    id, group_id, title, description, category_id, amount, paid_by, split_type,
    receipt_path, recurrence_id, date, created_by
  ) values (
    p_id, p_group_id, p_title, p_description, p_category_id, p_amount, p_paid_by, p_split_type,
    p_receipt_path, p_recurrence_id, p_date, auth.uid()
  );

  insert into public.expense_participants (expense_id, user_id, shares, exact_amount)
  select
    p_id,
    (part->>'userId')::uuid,
    (part->>'shares')::numeric,
    (part->>'exactAmount')::numeric
  from jsonb_array_elements(p_participants) as t(part);
end;
$$;

ALTER FUNCTION "public"."create_expense_with_participants"("p_id" "uuid", "p_group_id" "uuid", "p_title" "text", "p_category_id" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_description" "text", "p_receipt_path" "text", "p_recurrence_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."generate_invite_code"() RETURNS "text"
    LANGUAGE "sql"
    AS $$
  select string_agg(
    substr('abcdefghijklmnopqrstuvwxyz0123456789', (floor(random() * 36))::int + 1, 1),
    ''
  )
  from generate_series(1, 7);
$$;

ALTER FUNCTION "public"."generate_invite_code"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "avatar_key" "text",
    "invite_code" "text" DEFAULT "public"."generate_invite_code"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_path" "text",
    "default_split_type" "text" DEFAULT 'equal'::"text" NOT NULL,
    CONSTRAINT "groups_default_split_type_check" CHECK (("default_split_type" = ANY (ARRAY['equal'::"text", 'shares'::"text", 'exact'::"text"]))),
    CONSTRAINT "groups_name_check" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 60)))
);

ALTER TABLE "public"."groups" OWNER TO "postgres";

COMMENT ON COLUMN "public"."groups"."default_split_type" IS 'Divisão que o formulário de despesa abre por padrão neste rolê. Cada despesa continua podendo mudar a sua.';

CREATE OR REPLACE FUNCTION "public"."create_group_with_owner"("p_name" "text", "p_avatar_key" "text", "p_default_split_type" "text" DEFAULT 'equal'::"text") RETURNS "public"."groups"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_group public.groups;
begin
  insert into public.groups (name, avatar_key, created_by, default_split_type)
  values (p_name, p_avatar_key, auth.uid(), p_default_split_type)
  returning * into v_group;

  insert into public.group_members (group_id, user_id, role)
  values (v_group.id, auth.uid(), 'owner');

  return v_group;
end;
$$;

ALTER FUNCTION "public"."create_group_with_owner"("p_name" "text", "p_avatar_key" "text", "p_default_split_type" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_kind" "text", "p_family" "text", "p_title" "text", "p_context" "text", "p_href" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_actor_avatar_path" "text", "p_group_id" "uuid", "p_metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_user_id = auth.uid() then
    return;
  end if;

  insert into public.notifications (
    user_id, kind, family, title, context, href, actor_id, actor_name, actor_avatar_path, group_id, metadata
  ) values (
    p_user_id, p_kind, p_family, p_title, p_context, p_href, p_actor_id, p_actor_name, p_actor_avatar_path, p_group_id, p_metadata
  );
end;
$$;

ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_kind" "text", "p_family" "text", "p_title" "text", "p_context" "text", "p_href" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_actor_avatar_path" "text", "p_group_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_group_owner(gid) then
    raise exception 'only the group owner can demote an admin';
  end if;

  update public.group_members
  set role = 'member'
  where group_id = gid and user_id = target_user_id and role = 'admin';
end;
$$;

ALTER FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."enforce_role_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_is_premium boolean;
  v_active_count int;
begin
  if TG_OP = 'UPDATE' and (OLD.archived_at is null or NEW.archived_at is not null) then
    return new;
  end if;

  select p.is_premium into v_is_premium from public.profiles p where p.id = new.user_id;
  if coalesce(v_is_premium, false) then
    return new;
  end if;

  select count(*) into v_active_count
  from public.group_members
  where user_id = new.user_id and archived_at is null;

  if v_active_count >= 5 then
    raise exception 'role_limit_reached';
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."enforce_role_limit"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."find_group_by_invite_code"("code" "text") RETURNS "public"."groups"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  result public.groups;
begin
  select * into result from public.groups g where g.invite_code = lower(code);
  if not found then
    return null;
  end if;
  return result;
end;
$$;

ALTER FUNCTION "public"."find_group_by_invite_code"("code" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."group_last_activity"("p_group_ids" "uuid"[]) RETURNS TABLE("gid" "uuid", "last_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
  select ge.group_id, max(ge.at)
  from public.group_events ge
  where ge.group_id = any(p_group_ids)
  group by ge.group_id;
$$;

ALTER FUNCTION "public"."group_last_activity"("p_group_ids" "uuid"[]) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, name, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'language', 'pt-BR')
  );
  return new;
end;
$$;

ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_group_admin"("gid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

ALTER FUNCTION "public"."is_group_admin"("gid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_group_member"("gid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

ALTER FUNCTION "public"."is_group_member"("gid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."is_group_owner"("gid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'owner'
  );
$$;

ALTER FUNCTION "public"."is_group_owner"("gid" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_admin_role_changed_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
  v_member_name text;
begin
  if new.role is distinct from old.role then
    select name, avatar_path into v_actor_name, v_actor_avatar from public.profiles where id = v_actor_id;
    select name into v_member_name from public.profiles where id = new.user_id;

    insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
    values (
      new.group_id, 'admin_changed',
      coalesce(v_actor_id, new.user_id), coalesce(v_actor_name, v_member_name), v_actor_avatar,
      jsonb_build_object('memberUserId', new.user_id, 'memberName', v_member_name, 'roleFrom', old.role, 'roleTo', new.role)
    );
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."log_admin_role_changed_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_expense_deleted_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := coalesce(auth.uid(), old.paid_by);
  v_actor_name text;
  v_actor_avatar text;
begin
  select name, avatar_path into v_actor_name, v_actor_avatar from public.profiles where id = v_actor_id;

  begin
    insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
    values (
      old.group_id, 'expense_deleted', v_actor_id, v_actor_name, v_actor_avatar,
      jsonb_build_object(
        'expenseId', old.id,
        'title', old.title,
        'amount', old.amount
      )
    );
  exception when foreign_key_violation then
    -- O rolê já não existe mais (despesa apagada como parte da cascata de
    -- apagar o grupo inteiro) — sem sentido registrar histórico de um rolê
    -- que já sumiu, e essas linhas seriam cascade-apagadas de qualquer jeito.
    null;
  end;

  return old;
end;
$$;

ALTER FUNCTION "public"."log_expense_deleted_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_expense_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_expense_id uuid;
  v_expense record;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
  v_count int;
  v_total_shares numeric;
  v_base numeric;
  v_remainder_cents int;
  v_row record;
  v_share numeric;
  v_participants jsonb := '[]'::jsonb;
  v_paid_by_name text;
  v_prev jsonb;
  v_prev_amount numeric;
  v_prev_paid_by_name text;
  v_prev_title text;
  v_prev_category text;
  v_prev_receipt text;
  v_prev_split_type text;
  v_recurring boolean;
  v_ids_changed boolean;
  v_changed jsonb := '[]'::jsonb;
begin
  select expense_id into v_expense_id from new_participants limit 1;
  if v_expense_id is null then
    return null;
  end if;

  select e.id, e.title, e.amount, e.split_type, e.group_id, e.paid_by, e.date,
         e.category_id, e.receipt_path, e.recurrence_id
    into v_expense
  from public.expenses e
  where e.id = v_expense_id;

  v_recurring := v_expense.recurrence_id is not null;

  if v_actor_id is null then
    v_actor_id := v_expense.paid_by;
  end if;

  select name, avatar_path into v_actor_name, v_actor_avatar
  from public.profiles where id = v_actor_id;

  select name into v_paid_by_name from public.profiles where id = v_expense.paid_by;

  select count(*), coalesce(sum(coalesce(shares, 1)), 0) into v_count, v_total_shares from new_participants;

  v_base := floor(v_expense.amount / nullif(v_count, 0) * 100) / 100;
  v_remainder_cents := round((v_expense.amount - v_base * v_count) * 100)::int;

  for v_row in
    select np.*, row_number() over () as rn, p.name as participant_name
    from new_participants np
    join public.profiles p on p.id = np.user_id
  loop
    v_share := case v_expense.split_type
      when 'exact' then coalesce(v_row.exact_amount, 0)
      when 'shares' then round(v_expense.amount * coalesce(v_row.shares, 1) / nullif(v_total_shares, 0), 2)
      else v_base + (case when v_row.rn <= v_remainder_cents then 0.01 else 0 end)
    end;

    v_participants := v_participants || jsonb_build_object(
      'userId', v_row.user_id,
      'name', v_row.participant_name,
      'shares', case when v_expense.split_type = 'shares' then coalesce(v_row.shares, 1) else null end,
      'exactAmount', case when v_expense.split_type = 'exact' then v_share else null end
    );
  end loop;

  select payload into v_prev
  from public.group_events
  where type in ('expense_created', 'expense_edited')
    and payload->>'expenseId' = v_expense.id::text
  order by at desc
  limit 1;

  v_prev_amount := (v_prev->>'amount')::numeric;

  if v_prev is not null then
    v_prev_title := v_prev->>'title';
    v_prev_paid_by_name := v_prev->>'paidByName';
    v_prev_category := v_prev->>'categoryId';
    v_prev_receipt := v_prev->>'receiptPath';
    v_prev_split_type := v_prev->>'splitType';

    if abs(coalesce(v_prev_amount, 0) - v_expense.amount) > 0.005 then
      v_changed := v_changed || '"amount"'::jsonb;
    end if;

    if v_prev_title is distinct from v_expense.title then
      v_changed := v_changed || '"title"'::jsonb;
    end if;

    -- Cada campo é comparado só quando EXISTE no payload anterior. Testar a
    -- presença da chave (`?`), e não se o valor é nulo: categoria e comprovante
    -- são legitimamente nulos, e confundir "não tinha" com "não sabíamos"
    -- anunciaria mudança que ninguém fez em toda despesa anterior à 0094/0095.
    if v_prev ? 'paidById' and (v_prev->>'paidById') is distinct from v_expense.paid_by::text then
      v_changed := v_changed || '"paidBy"'::jsonb;
    end if;

    if v_prev ? 'date' and (v_prev->>'date') is distinct from v_expense.date::text then
      v_changed := v_changed || '"date"'::jsonb;
    end if;

    if v_prev_split_type is distinct from v_expense.split_type then
      v_changed := v_changed || '"splitType"'::jsonb;
    end if;

    if v_prev ? 'categoryId' and v_prev_category is distinct from v_expense.category_id then
      v_changed := v_changed || '"category"'::jsonb;
    end if;

    if v_prev ? 'receiptPath' then
      if v_prev_receipt is null and v_expense.receipt_path is not null then
        v_changed := v_changed || '"receiptAdded"'::jsonb;
      elsif v_prev_receipt is not null and v_expense.receipt_path is null then
        v_changed := v_changed || '"receiptRemoved"'::jsonb;
      elsif v_prev_receipt is distinct from v_expense.receipt_path then
        v_changed := v_changed || '"receiptChanged"'::jsonb;
      end if;
    end if;

    if v_prev ? 'recurring' and (v_prev->>'recurring')::boolean is distinct from v_recurring then
      v_changed := v_changed || case when v_recurring then '"recurringOn"'::jsonb else '"recurringOff"'::jsonb end;
    end if;

    -- Divisão em dois níveis: mudou QUEM entra, ou mudou QUANTO cada um paga
    -- com as mesmas pessoas. São coisas diferentes pra quem lê, e a segunda
    -- move dinheiro sem mexer em mais nada.
    v_ids_changed := (
      select coalesce(array_agg(p->>'userId' order by p->>'userId'), '{}')
      from jsonb_array_elements(coalesce(v_prev->'participants', '[]'::jsonb)) as p
    ) is distinct from (
      select coalesce(array_agg(p->>'userId' order by p->>'userId'), '{}')
      from jsonb_array_elements(v_participants) as p
    );

    if v_ids_changed then
      v_changed := v_changed || '"participants"'::jsonb;
    elsif (
      select coalesce(jsonb_agg(jsonb_build_object(
        'u', p->>'userId', 's', p->>'shares', 'e', p->>'exactAmount'
      ) order by p->>'userId'), '[]'::jsonb)
      from jsonb_array_elements(coalesce(v_prev->'participants', '[]'::jsonb)) as p
    ) is distinct from (
      select coalesce(jsonb_agg(jsonb_build_object(
        'u', p->>'userId', 's', p->>'shares', 'e', p->>'exactAmount'
      ) order by p->>'userId'), '[]'::jsonb)
      from jsonb_array_elements(v_participants) as p
    ) then
      v_changed := v_changed || '"splitValues"'::jsonb;
    end if;

    -- Edição que não mexeu em nada visível não vira linha. Só quando o evento
    -- anterior já tem o diff completo (`changed`, criado pela 0094): num
    -- payload mais velho a comparação é parcial, e calar aqui poderia engolir
    -- uma troca de categoria ou comprovante que a gente não soube comparar.
    if v_prev ? 'changed' and jsonb_array_length(v_changed) = 0 then
      return null;
    end if;
  end if;

  insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
  values (
    v_expense.group_id,
    case when v_prev is null then 'expense_created' else 'expense_edited' end,
    v_actor_id, v_actor_name, v_actor_avatar,
    jsonb_build_object(
      'expenseId', v_expense.id,
      'title', v_expense.title,
      'amount', v_expense.amount,
      'prevAmount', v_prev_amount,
      'paidById', v_expense.paid_by,
      'paidByName', v_paid_by_name,
      'prevPaidByName', case when v_changed ? 'paidBy' then v_prev_paid_by_name else null end,
      'date', v_expense.date,
      'prevTitle', case when v_changed ? 'title' then v_prev_title else null end,
      'categoryId', v_expense.category_id,
      'prevCategoryId', case when v_changed ? 'category' then v_prev_category else null end,
      'receiptPath', v_expense.receipt_path,
      'recurring', v_recurring,
      'splitType', v_expense.split_type,
      'prevSplitType', case when v_changed ? 'splitType' then v_prev_split_type else null end,
      'participants', v_participants,
      'changed', v_changed
    )
  );

  return null;
end;
$$;

ALTER FUNCTION "public"."log_expense_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_group_created_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_name text;
  v_actor_avatar text;
begin
  select name, avatar_path into v_actor_name, v_actor_avatar from public.profiles where id = new.created_by;

  insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
  values (new.id, 'group_created', new.created_by, v_actor_name, v_actor_avatar, '{}'::jsonb);

  return new;
end;
$$;

ALTER FUNCTION "public"."log_group_created_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_group_edited_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
  v_name_changed boolean := old.name is distinct from new.name;
  v_avatar_changed boolean := old.avatar_path is distinct from new.avatar_path
    or old.avatar_key is distinct from new.avatar_key;
begin
  if coalesce(current_setting('app.skip_group_event', true), '') = 'on' then
    return new;
  end if;

  if not v_name_changed and not v_avatar_changed then
    return new;
  end if;

  select name, avatar_path into v_actor_name, v_actor_avatar from public.profiles where id = v_actor_id;

  insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
  values (
    new.id, 'group_edited', v_actor_id, v_actor_name, v_actor_avatar,
    jsonb_build_object(
      'nameChanged', v_name_changed,
      'avatarChanged', v_avatar_changed,
      'newName', new.name
    )
  );

  return new;
end;
$$;

ALTER FUNCTION "public"."log_group_edited_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_member_joined_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_name text;
  v_avatar text;
begin
  if not exists (
    select 1 from public.group_members where group_id = new.group_id and user_id <> new.user_id
  ) then
    return new;
  end if;

  select name, avatar_path into v_name, v_avatar from public.profiles where id = new.user_id;

  insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
  values (
    new.group_id, 'member_joined', new.user_id, v_name, v_avatar,
    jsonb_build_object('memberUserId', new.user_id, 'memberName', v_name)
  );

  return new;
end;
$$;

ALTER FUNCTION "public"."log_member_joined_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_member_left_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_member_name text;
  v_member_avatar text;
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
  v_removed boolean;
begin
  select name, avatar_path into v_member_name, v_member_avatar from public.profiles where id = old.user_id;

  v_removed := v_actor_id is distinct from old.user_id;
  if v_removed and v_actor_id is not null then
    select name, avatar_path into v_actor_name, v_actor_avatar from public.profiles where id = v_actor_id;
  else
    v_actor_id := old.user_id;
    v_actor_name := v_member_name;
    v_actor_avatar := v_member_avatar;
  end if;

  begin
    insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
    values (
      old.group_id, 'member_left', v_actor_id, v_actor_name, v_actor_avatar,
      jsonb_build_object('memberUserId', old.user_id, 'memberName', v_member_name, 'removedByActor', v_removed)
    );
  exception when foreign_key_violation then
    null;
  end;

  return old;
end;
$$;

ALTER FUNCTION "public"."log_member_left_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_recurrence_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_actor_avatar text;
  v_paused_changed boolean := old.paused is distinct from new.paused;
  v_rhythm_changed boolean := old.freq is distinct from new.freq
    or old.interval_days is distinct from new.interval_days
    or old.end_date is distinct from new.end_date;
  v_type text;
begin
  if not v_paused_changed and not v_rhythm_changed then
    return new;
  end if;

  -- O cron roda como service role e mexe em next_run_date/active sem ator. Só
  -- registra o que uma PESSOA fez — sem isto, o materializador encerrando uma
  -- série no fim do prazo viraria "alguém editou a recorrência".
  if v_actor_id is null then
    return new;
  end if;

  select name, avatar_path into v_actor_name, v_actor_avatar
  from public.profiles where id = v_actor_id;

  -- Pausar/retomar ganha do ritmo quando os dois mudam na mesma transação: é o
  -- que a pessoa percebe que fez.
  v_type := case
    when v_paused_changed and new.paused then 'recurrence_paused'
    when v_paused_changed then 'recurrence_resumed'
    else 'recurrence_edited'
  end;

  insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
  values (
    new.group_id, v_type, v_actor_id, v_actor_name, v_actor_avatar,
    jsonb_build_object(
      'recurrenceId', new.id,
      'title', new.title,
      'freq', new.freq,
      'intervalDays', new.interval_days,
      'endDate', new.end_date,
      'prevFreq', case when old.freq is distinct from new.freq then old.freq else null end,
      'prevIntervalDays', case when old.interval_days is distinct from new.interval_days then old.interval_days else null end,
      'prevEndDate', case when old.end_date is distinct from new.end_date then old.end_date else null end,
      'endDateChanged', old.end_date is distinct from new.end_date
    )
  );

  return new;
end;
$$;

ALTER FUNCTION "public"."log_recurrence_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."log_settlement_confirmed_history"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_to_name text;
  v_to_avatar text;
  v_from_name text;
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    select name, avatar_path into v_to_name, v_to_avatar from public.profiles where id = new.to_user;
    select name into v_from_name from public.profiles where id = new.from_user;

    insert into public.group_events (group_id, type, actor_id, actor_name, actor_avatar_path, payload)
    values (
      new.group_id, 'settlement', new.to_user, v_to_name, v_to_avatar,
      jsonb_build_object(
        'settlementId', new.id,
        'fromUserId', new.from_user,
        'fromName', v_from_name,
        'toUserId', new.to_user,
        'toName', v_to_name,
        'amount', new.amount,
        'hasProof', new.proof_path is not null
      )
    );
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."log_settlement_confirmed_history"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."materialize_recurring_expenses"("p_recurrence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_rec record;
  v_expense_id uuid;
  v_guard int;
  v_seed_date date;
begin
  for v_rec in
    select er.*, (now() at time zone coalesce(p.timezone, 'UTC'))::date as today_local
    from public.expense_recurrences er
    join public.profiles p on p.id = er.created_by
    where er.active
      and not er.paused
      and er.deleted_at is null
      and er.next_run_date <= (now() at time zone coalesce(p.timezone, 'UTC'))::date
      and (p_recurrence_id is null or er.id = p_recurrence_id)
  loop
    select min(date) into v_seed_date
    from public.expenses where recurrence_id = v_rec.id;

    v_guard := 0;
    while v_rec.next_run_date <= v_rec.today_local and v_guard < 60 loop
      v_guard := v_guard + 1;

      if v_seed_date is null or v_rec.next_run_date <> v_seed_date then
        insert into public.expenses (
          group_id, title, category_id, amount, paid_by, split_type,
          recurrence_id, receipt_path, date, created_by
        ) values (
          v_rec.group_id, v_rec.title, v_rec.category_id, v_rec.amount, v_rec.paid_by, v_rec.split_type,
          v_rec.id, v_rec.receipt_path, v_rec.next_run_date, v_rec.created_by
        )
        returning id into v_expense_id;

        insert into public.expense_participants (expense_id, user_id, shares, exact_amount)
        select
          v_expense_id,
          (part->>'userId')::uuid,
          (part->>'shares')::numeric,
          (part->>'exactAmount')::numeric
        from jsonb_array_elements(v_rec.participants) as t(part);
      end if;

      v_rec.next_run_date := public.next_recurrence_date(
        v_rec.next_run_date, v_rec.freq, v_rec.interval_days, v_rec.anchor_day
      );

      if v_rec.end_date is not null and v_rec.next_run_date > v_rec.end_date then
        update public.expense_recurrences
          set next_run_date = v_rec.next_run_date, active = false
          where id = v_rec.id;
        exit;
      end if;

      update public.expense_recurrences
        set next_run_date = v_rec.next_run_date
        where id = v_rec.id;
    end loop;
  end loop;
end;
$$;

ALTER FUNCTION "public"."materialize_recurring_expenses"("p_recurrence_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."next_recurrence_date"("p_from" "date", "p_freq" "text", "p_interval_days" integer, "p_anchor_day" integer DEFAULT NULL::integer) RETURNS "date"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_freq
    when 'daily' then p_from + interval '1 day'
    when 'weekly' then p_from + interval '7 days'
    when 'monthly' then public.add_months_clamped(p_from, 1, p_anchor_day)
    when 'yearly' then public.add_months_clamped(p_from, 12, p_anchor_day)
    else p_from + make_interval(days => coalesce(p_interval_days, 1))
  end;
$$;

ALTER FUNCTION "public"."next_recurrence_date"("p_from" "date", "p_freq" "text", "p_interval_days" integer, "p_anchor_day" integer) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_admin_role_changed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if old.role = 'member' and new.role in ('admin', 'owner') then
    perform public.send_push_event(
      new.user_id, null, 'admin_granted', new.group_id, jsonb_build_object()
    );
  elsif old.role in ('admin', 'owner') and new.role = 'member' then
    perform public.send_push_event(
      new.user_id, null, 'admin_revoked', new.group_id, jsonb_build_object()
    );
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."notify_admin_role_changed"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_expense_participants"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_expense_id uuid;
  v_expense record;
  v_actor_id uuid := auth.uid();
  v_count int;
  v_total_shares numeric;
  v_total_cents bigint;
  v_base numeric;
  v_remainder_cents int;
  v_row record;
  v_share numeric;
  v_payer_share numeric;
  v_receive_amount numeric;
  v_prev_share numeric;
  v_delta numeric;
  v_share_ids uuid[];
  v_share_base_cents bigint[];
  v_share_used_cents bigint;
  v_share_remainder_cents bigint;
begin
  select expense_id into v_expense_id from new_participants limit 1;
  if v_expense_id is null then
    return null;
  end if;

  select e.id, e.amount, e.split_type, e.paid_by, e.group_id into v_expense
  from public.expenses e
  where e.id = v_expense_id;

  select count(*), coalesce(sum(coalesce(shares, 1)), 0) into v_count, v_total_shares from new_participants;

  v_total_cents := round(v_expense.amount * 100);
  v_base := floor(v_expense.amount / nullif(v_count, 0) * 100) / 100;
  v_remainder_cents := round((v_expense.amount - v_base * v_count) * 100)::int;

  -- Pré-computa a base em centavos de cada participante (ordem de inserção)
  -- pra divisão "shares" — mesma técnica de sobra-pros-primeiros da divisão
  -- igual, só que a base é proporcional ao peso, não igual pra todos.
  if v_expense.split_type = 'shares' then
    select array_agg(user_id order by rn), array_agg(floor(v_total_cents * coalesce(shares, 1) / nullif(v_total_shares, 0)) order by rn)
      into v_share_ids, v_share_base_cents
    from (select *, row_number() over () as rn from new_participants) x;

    select coalesce(sum(c), 0) into v_share_used_cents from unnest(v_share_base_cents) as c;
    v_share_remainder_cents := v_total_cents - v_share_used_cents;
  end if;

  v_payer_share := null;

  for v_row in select *, row_number() over () as rn from new_participants loop
    v_share := case v_expense.split_type
      when 'exact' then coalesce(v_row.exact_amount, 0)
      when 'shares' then (
        v_share_base_cents[v_row.rn] + (case when v_row.rn <= v_share_remainder_cents then 1 else 0 end)
      ) / 100.0
      else v_base + (case when v_row.rn <= v_remainder_cents then 0.01 else 0 end)
    end;

    if v_row.user_id = v_expense.paid_by then
      v_payer_share := v_share;
    else
      select (metadata->>'share')::numeric into v_prev_share
      from public.push_log
      where kind = 'expense_you_owe'
        and metadata->>'expenseId' = v_expense.id::text
        and recipient_id = v_row.user_id
      order by created_at desc
      limit 1;

      if v_prev_share is null then
        perform public.send_push_event(
          v_row.user_id, v_actor_id, 'expense_you_owe', v_expense.group_id,
          jsonb_build_object('expenseId', v_expense.id, 'share', v_share, 'isEdit', false)
        );
      else
        v_delta := v_share - v_prev_share;
        if v_delta > 0.005 then
          perform public.send_push_event(
            v_row.user_id, v_actor_id, 'expense_you_owe', v_expense.group_id,
            jsonb_build_object('expenseId', v_expense.id, 'share', v_share, 'isEdit', true, 'prevShare', v_prev_share)
          );
        end if;
      end if;
    end if;
  end loop;

  v_receive_amount := v_expense.amount - coalesce(v_payer_share, 0);
  if v_receive_amount > 0.005 then
    select (metadata->>'share')::numeric into v_prev_share
    from public.push_log
    where kind = 'expense_you_receive'
      and metadata->>'expenseId' = v_expense.id::text
      and recipient_id = v_expense.paid_by
    order by created_at desc
    limit 1;

    if v_prev_share is null then
      perform public.send_push_event(
        v_expense.paid_by, v_actor_id, 'expense_you_receive', v_expense.group_id,
        jsonb_build_object('expenseId', v_expense.id, 'share', v_receive_amount, 'isEdit', false)
      );
    else
      v_delta := v_receive_amount - v_prev_share;
      if v_delta > 0.005 then
        perform public.send_push_event(
          v_expense.paid_by, v_actor_id, 'expense_you_receive', v_expense.group_id,
          jsonb_build_object('expenseId', v_expense.id, 'share', v_receive_amount, 'isEdit', true, 'prevShare', v_prev_share)
        );
      end if;
    end if;
  end if;

  return null;
end;
$$;

ALTER FUNCTION "public"."notify_expense_participants"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_group_edited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_name_changed boolean := old.name is distinct from new.name;
  v_avatar_changed boolean := old.avatar_path is distinct from new.avatar_path
    or old.avatar_key is distinct from new.avatar_key;
begin
  if coalesce(current_setting('app.skip_group_event', true), '') = 'on' then
    return new;
  end if;

  if not v_name_changed and not v_avatar_changed then
    return new;
  end if;

  perform public.send_push_event(
    gm.user_id, auth.uid(), 'group_edited', new.id,
    jsonb_build_object('nameChanged', v_name_changed, 'avatarChanged', v_avatar_changed, 'newName', new.name)
  )
  from public.group_members gm
  where gm.group_id = new.id;

  return new;
end;
$$;

ALTER FUNCTION "public"."notify_group_edited"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_member_joined"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.send_push_event(gm.user_id, new.user_id, 'member_joined', new.group_id, jsonb_build_object())
  from public.group_members gm
  where gm.group_id = new.group_id and gm.user_id <> new.user_id;

  return new;
end;
$$;

ALTER FUNCTION "public"."notify_member_joined"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_member_left"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.send_push_event(gm.user_id, old.user_id, 'member_left', old.group_id, jsonb_build_object())
  from public.group_members gm
  where gm.group_id = old.group_id and gm.user_id <> old.user_id;

  return old;
end;
$$;

ALTER FUNCTION "public"."notify_member_left"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_open_balances"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  perform public.send_push_event(b.user_id, null, 'reminder_open_balance', b.group_id, b.metadata)
  from (
    with expense_totals as (
      select paid_by as user_id, group_id, sum(amount) as paid_total
      from public.expenses
      group by paid_by, group_id
    ),
    expense_agg as (
      select expense_id, count(*) as participant_count, sum(coalesce(shares, 1)) as total_shares
      from public.expense_participants
      group by expense_id
    ),
    expense_shares as (
      select ep.user_id, e.group_id,
        sum(
          case e.split_type
            when 'exact' then coalesce(ep.exact_amount, 0)
            when 'shares' then round(e.amount * coalesce(ep.shares, 1) / nullif(agg.total_shares, 0), 2)
            else round(e.amount / nullif(agg.participant_count, 0), 2)
          end
        ) as owed_total
      from public.expense_participants ep
      join public.expenses e on e.id = ep.expense_id
      join expense_agg agg on agg.expense_id = ep.expense_id
      group by ep.user_id, e.group_id
    ),
    payment_totals as (
      select user_id, group_id, sum(delta) as payment_delta
      from (
        select from_user as user_id, group_id, amount as delta from public.payments
        union all
        select to_user as user_id, group_id, -amount as delta from public.payments
      ) pay
      group by user_id, group_id
    ),
    group_activity as (
      select group_id, max(created_at) as last_activity from (
        select group_id, created_at from public.expenses
        union all
        select group_id, created_at from public.payments
        union all
        select group_id, marked_at as created_at from public.settlements
        union all
        -- A linha nova. Cobre o que não deixa linha viva pra trás: despesa
        -- apagada, despesa editada, membro entrou/saiu, admin trocado, rolê
        -- renomeado, rolê criado.
        select group_id, at as created_at from public.group_events
      ) a
      group by group_id
    ),
    balances as (
      select gm.user_id, gm.group_id,
        coalesce(et.paid_total, 0) - coalesce(es.owed_total, 0) + coalesce(pt.payment_delta, 0) as balance
      from public.group_members gm
      left join expense_totals et on et.user_id = gm.user_id and et.group_id = gm.group_id
      left join expense_shares es on es.user_id = gm.user_id and es.group_id = gm.group_id
      left join payment_totals pt on pt.user_id = gm.user_id and pt.group_id = gm.group_id
    ),
    stale_balances as (
      select bal.*
      from balances bal
      join group_activity ga on ga.group_id = bal.group_id
      where ga.last_activity <= now() - interval '7 days'
    ),
    creditors as (
      select * from stale_balances where balance > 0.5
    ),
    creditor_counts as (
      select group_id, count(*) as cnt from creditors group by group_id
    ),
    single_creditor as (
      select c.group_id, p.name as creditor_name
      from creditors c
      join creditor_counts cc on cc.group_id = c.group_id and cc.cnt = 1
      join public.profiles p on p.id = c.user_id
    ),
    candidates as (
      select
        user_id, group_id,
        jsonb_build_object('role', 'creditor', 'balance', balance) as metadata
      from creditors

      union all

      select
        d.user_id, d.group_id,
        jsonb_build_object('role', 'debtor', 'balance', abs(d.balance), 'creditorName', sc.creditor_name) as metadata
      from stale_balances d
      left join single_creditor sc on sc.group_id = d.group_id
      where d.balance < -0.5
    )
    select c.user_id, c.group_id, c.metadata
    from candidates c
    where not exists (
      select 1 from public.push_log pl
      where pl.recipient_id = c.user_id
        and pl.group_id = c.group_id
        and pl.kind = 'reminder_open_balance'
        and pl.created_at >= now() - interval '7 days'
    )
  ) b;
end;
$$;

ALTER FUNCTION "public"."notify_open_balances"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_settlement_confirmed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.send_push_event(
      new.from_user, new.to_user, 'settle_confirmed', new.group_id,
      jsonb_build_object('settlementId', new.id, 'amount', new.amount)
    );
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."notify_settlement_confirmed"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."notify_settlement_marked_paid"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- Credor registrando o próprio recebimento: ele é o destinatário deste push.
  -- O de confirmação (on_settlement_confirmed) segue normal — é o que
  -- interessa ao devedor, e é o único que faz sentido neste caminho.
  if new.recorded_by_creditor then
    return new;
  end if;

  perform public.send_push_event(
    new.to_user, new.from_user, 'settle_paid_wait_confirm', new.group_id,
    jsonb_build_object('settlementId', new.id, 'amount', new.amount)
  );

  if new.proof_path is not null then
    perform public.send_push_event(
      new.to_user, new.from_user, 'proof_attached', new.group_id,
      jsonb_build_object('settlementId', new.id, 'amount', new.amount)
    );
  end if;

  return new;
end;
$$;

ALTER FUNCTION "public"."notify_settlement_marked_paid"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."pause_recurrences_of_departed_member"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- 1) Séries que dependem de quem saiu param: o pagador ausente geraria
  --    despesa paga por quem não está mais no rolê, e o criador é de quem o
  --    materializador tira o fuso pra decidir o dia (ver 0102).
  update public.expense_recurrences
    set paused = true
    where group_id = old.group_id
      and (created_by = old.user_id or paid_by = old.user_id)
      -- Já parada ou já encerrada não tem o que pausar, e o update à toa
      -- dispararia o gatilho de histórico com um evento que não aconteceu.
      and not paused
      and active
      and deleted_at is null;

  -- 2) Nas demais, quem saiu deixa de ser rateado. O filtro do `where` evita
  --    reescrever o JSON de séries em que ele nem estava.
  --
  --    `- 'exact_amount'` não entra aqui: o rateio por valores exatos guarda o
  --    valor de cada um, e tirar uma pessoa deixaria a soma menor que o total
  --    da despesa. Some com a linha dela do mesmo jeito — a diferença vira
  --    problema de quem ficou, que é quem pode corrigir, e não uma cobrança
  --    fantasma pra quem saiu.
  update public.expense_recurrences er
    set participants = (
      select coalesce(jsonb_agg(p), '[]'::jsonb)
      from jsonb_array_elements(er.participants) as t(p)
      where p->>'userId' is distinct from old.user_id::text
    )
    where er.group_id = old.group_id
      and er.deleted_at is null
      and exists (
        select 1 from jsonb_array_elements(er.participants) as t(p)
        where p->>'userId' = old.user_id::text
      );

  -- 3) Sem ninguém no rateio, a série não tem o que lançar.
  update public.expense_recurrences
    set paused = true
    where group_id = old.group_id
      and jsonb_array_length(participants) = 0
      and not paused
      and active
      and deleted_at is null;

  return old;
end;
$$;

ALTER FUNCTION "public"."pause_recurrences_of_departed_member"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."promote_oldest_after_admin_leaves"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  next_owner uuid;
begin
  if old.role = 'owner' and not exists (
    select 1 from public.group_members where group_id = old.group_id and role = 'owner'
  ) then
    select user_id into next_owner
    from public.group_members
    where group_id = old.group_id
    order by case when role = 'admin' then 0 else 1 end, created_at asc
    limit 1;

    if next_owner is not null then
      update public.group_members
      set role = 'owner'
      where group_id = old.group_id and user_id = next_owner;
    end if;
  end if;

  return old;
end;
$$;

ALTER FUNCTION "public"."promote_oldest_after_admin_leaves"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."record_receipt"("p_group_id" "uuid", "p_from_user" "uuid", "p_amount" numeric) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_settlement_id uuid;
begin
  if not public.is_group_member(p_group_id) then
    raise exception 'not_a_member';
  end if;

  if p_from_user = auth.uid() then
    raise exception 'cannot_settle_with_self';
  end if;

  -- Reaproveita a marcação do devedor que ainda esteja de pé, pra não deixar
  -- linha órfã pendurada. Só quando o valor ainda bate: settlement cujo valor
  -- não corresponde mais ao saldo de hoje é tratada como obsoleta pelo client
  -- (o guard de "stale" em useSettlements/useWallet), e confirmá-la acertaria
  -- um valor que não é mais o devido.
  select id into v_settlement_id
  from public.settlements
  where group_id = p_group_id
    and from_user = p_from_user
    and to_user = auth.uid()
    and status = 'marked_paid'
    and abs(amount - p_amount) < 0.005
  limit 1;

  if v_settlement_id is null then
    insert into public.settlements (group_id, from_user, to_user, amount, status, recorded_by_creditor)
    values (p_group_id, p_from_user, auth.uid(), p_amount, 'marked_paid', true)
    returning id into v_settlement_id;
  end if;

  perform public.confirm_settlement(v_settlement_id);
end;
$$;

ALTER FUNCTION "public"."record_receipt"("p_group_id" "uuid", "p_from_user" "uuid", "p_amount" numeric) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."send_push_event"("p_recipient_id" "uuid", "p_actor_id" "uuid", "p_kind" "text", "p_group_id" "uuid", "p_metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if p_recipient_id is null or p_recipient_id = p_actor_id then
    return;
  end if;

  -- Mesmo raciocínio de log_expense_deleted_history: se o rolê já não
  -- existe mais (evento disparado como parte da cascata de apagar o grupo
  -- inteiro), não há push nem log pra fazer.
  if p_group_id is not null and not exists (select 1 from public.groups where id = p_group_id) then
    return;
  end if;

  insert into public.push_log (recipient_id, actor_id, kind, group_id, metadata)
  values (p_recipient_id, p_actor_id, p_kind, p_group_id, p_metadata);

  perform net.http_post(
    url := 'https://ymmjwmjnuqvnhpvxaggu.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltbWp3bWpudXF2bmhwdnhhZ2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3OTc4NjksImV4cCI6MjA5OTM3Mzg2OX0.bI4FGr2CbbitF0TXR5zGreoRmtzXas0d5NfouX2tFI4',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'recipientId', p_recipient_id,
      'actorId', p_actor_id,
      'kind', p_kind,
      'groupId', p_group_id,
      'metadata', p_metadata
    )
  );
end;
$$;

ALTER FUNCTION "public"."send_push_event"("p_recipient_id" "uuid", "p_actor_id" "uuid", "p_kind" "text", "p_group_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_expense_date"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.date is null then
    new.date := (new.created_at at time zone 'UTC')::date;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."set_expense_date"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_group_avatar_on_create"("p_group_id" "uuid", "p_path" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  -- SECURITY DEFINER exige a checagem explícita: sem ela, qualquer autenticado
  -- trocaria a foto de qualquer rolê. Admin, e não só membro, porque é a mesma
  -- barra do UPDATE normal (policy groups_update_admin) — esta função é um
  -- atalho pro evento, não pra permissão.
  if not public.is_group_admin(p_group_id) then
    raise exception 'not_group_admin';
  end if;

  -- Marca válida só nesta transação (o `true` do terceiro argumento). Os dois
  -- gatilhos abaixo a consultam; qualquer outro caminho que atualize a foto
  -- não a tem e segue registrando normalmente.
  perform set_config('app.skip_group_event', 'on', true);

  update public.groups set avatar_path = p_path where id = p_group_id;
end;
$$;

ALTER FUNCTION "public"."set_group_avatar_on_create"("p_group_id" "uuid", "p_path" "text") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if archived then
    if abs(public.user_group_balance(auth.uid(), gid)) > 0.01 then
      raise exception 'archive_requires_settled';
    end if;

    if exists (
      select 1 from public.settlements
      where group_id = gid and status = 'marked_paid' and (from_user = auth.uid() or to_user = auth.uid())
    ) then
      raise exception 'archive_requires_settled';
    end if;
  end if;

  update public.group_members
  set archived_at = case when archived then now() else null end
  where group_id = gid and user_id = auth.uid();
end;
$$;

ALTER FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."set_recurrence_anchor_day"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.anchor_day is null then
    new.anchor_day := extract(day from new.next_run_date)::int;
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."set_recurrence_anchor_day"() OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."shares_group_with"("other" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b using (group_id)
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

ALTER FUNCTION "public"."shares_group_with"("other" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.is_group_owner(gid) then
    raise exception 'only the group owner can transfer ownership';
  end if;

  if not exists (
    select 1 from public.group_members where group_id = gid and user_id = new_owner_user_id
  ) then
    raise exception 'target user is not a member of the group';
  end if;

  update public.group_members
  set role = 'admin'
  where group_id = gid and user_id = auth.uid() and role = 'owner';

  update public.group_members
  set role = 'owner'
  where group_id = gid and user_id = new_owner_user_id;
end;
$$;

ALTER FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."update_expense_with_participants"("p_id" "uuid", "p_title" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_category_id" "text" DEFAULT NULL::"text", "p_receipt_path" "text" DEFAULT NULL::"text", "p_set_recurrence" boolean DEFAULT false, "p_recurrence_id" "uuid" DEFAULT NULL::"uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_found boolean;
begin
  update public.expenses set
    title             = p_title,
    amount            = p_amount,
    paid_by           = p_paid_by,
    split_type        = p_split_type,
    date              = p_date,
    category_id       = p_category_id,
    receipt_path      = p_receipt_path,
    recurrence_id     = case when p_set_recurrence then p_recurrence_id else recurrence_id end
  where id = p_id;

  get diagnostics v_found = row_count;

  -- Apagada enquanto a edição esperava na fila (ou por outra pessoa do rolê).
  -- Sair aqui é o certo: seguir adiante inseriria participantes órfãos e
  -- estouraria na FK, deixando a mutação em erro permanente.
  if not v_found then
    return;
  end if;

  delete from public.expense_participants where expense_id = p_id;

  insert into public.expense_participants (expense_id, user_id, shares, exact_amount)
  select
    p_id,
    (part->>'userId')::uuid,
    (part->>'shares')::numeric,
    (part->>'exactAmount')::numeric
  from jsonb_array_elements(p_participants) as t(part);
end;
$$;

ALTER FUNCTION "public"."update_expense_with_participants"("p_id" "uuid", "p_title" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_category_id" "text", "p_receipt_path" "text", "p_set_recurrence" boolean, "p_recurrence_id" "uuid") OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."user_group_balance"("p_user_id" "uuid", "p_group_id" "uuid") RETURNS numeric
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with paid as (
    select coalesce(sum(amount), 0) as total
    from public.expenses
    where group_id = p_group_id and paid_by = p_user_id
  ),
  expense_totals as (
    select expense_id, count(*) as participant_count, sum(coalesce(shares, 1)) as total_shares
    from public.expense_participants
    group by expense_id
  ),
  owed as (
    select coalesce(sum(
      case e.split_type
        when 'exact'  then coalesce(ep.exact_amount, 0)
        when 'shares' then e.amount * coalesce(ep.shares, 1)::numeric / nullif(t.total_shares, 0)
        else e.amount / nullif(t.participant_count, 0)
      end
    ), 0) as total
    from public.expense_participants ep
    join public.expenses e on e.id = ep.expense_id
    join expense_totals t on t.expense_id = e.id
    where e.group_id = p_group_id and ep.user_id = p_user_id
  ),
  payments_out as (
    select coalesce(sum(amount), 0) as total
    from public.payments
    where group_id = p_group_id and from_user = p_user_id
  ),
  payments_in as (
    select coalesce(sum(amount), 0) as total
    from public.payments
    where group_id = p_group_id and to_user = p_user_id
  )
  select (select total from paid) - (select total from owed)
       + (select total from payments_out) - (select total from payments_in);
$$;

ALTER FUNCTION "public"."user_group_balance"("p_user_id" "uuid", "p_group_id" "uuid") OWNER TO "postgres";
