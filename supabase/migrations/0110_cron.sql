-- ═══════════════════════════════════════════════════════════════════════════
-- 0110 — Agendamentos e gatilho de cadastro
--
-- Os dois cron jobs e o gatilho que cria o perfil no cadastro. Nenhum dos
-- três vem do pg_dump (`cron` e `auth` são schemas excluídos).
--
-- Conjunto ESSENCIAL: reconstruído do schema que está em produção, não da
-- sequência histórica. Sem coluna que nasceu e morreu, sem função redefinida
-- 18 vezes. O porquê de cada decisão está em supabase/migrations_archive/.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Agendamentos — NÃO vêm do pg_dump (schema `cron` é excluído)
-- ═══════════════════════════════════════════════════════════════════════════
select cron.unschedule('materialize-recurring-expenses-hourly')
  where exists (select 1 from cron.job where jobname = 'materialize-recurring-expenses-hourly');

select cron.schedule(
  'materialize-recurring-expenses-hourly',
  '0 * * * *',
  $$select public.materialize_recurring_expenses();$$
);

select cron.unschedule('notify-open-balances-daily')
  where exists (select 1 from cron.job where jobname = 'notify-open-balances-daily');

select cron.schedule(
  'notify-open-balances-daily',
  '0 12 * * *',
  $$select public.notify_open_balances();$$
);

-- ═══════════════════════════════════════════════════════════════════════════
-- Gatilho de criação de perfil — NÃO vem do pg_dump (schema `auth` é excluído)
--
-- O mais silencioso dos quatro itens desta parte final: a FUNÇÃO
-- `public.handle_new_user` está no dump (é do schema public), só o GATILHO que
-- a dispara é que não — ele mora em `auth.users`. Um banco reconstruído sem
-- esta linha parece completo e passa em qualquer inspeção de schema, mas todo
-- cadastro novo cria usuário em auth SEM linha em `profiles`: a pessoa entra
-- sem nome, sem idioma, e toda query que junta profiles devolve vazio pra ela.
-- ═══════════════════════════════════════════════════════════════════════════
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
