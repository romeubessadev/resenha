-- ═══════════════════════════════════════════════════════════════════════════
-- 0107 — Tabelas, chaves e índices
--
-- As 11 tabelas do app, com chaves estrangeiras e índices.
--
-- Conjunto ESSENCIAL: reconstruído do schema que está em produção, não da
-- sequência histórica. Sem coluna que nasceu e morreu, sem função redefinida
-- 18 vezes. O porquê de cada decisão está em supabase/migrations_archive/.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS "public"."expense_participants" (
    "expense_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "shares" integer,
    "exact_amount" numeric(12,2),
    CONSTRAINT "expense_participants_exact_amount_check" CHECK (("exact_amount" >= (0)::numeric)),
    CONSTRAINT "expense_participants_shares_check" CHECK (("shares" > 0))
);

ALTER TABLE "public"."expense_participants" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."expense_recurrences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "split_type" "text" NOT NULL,
    "paid_by" "uuid" NOT NULL,
    "participants" "jsonb" NOT NULL,
    "freq" "text" NOT NULL,
    "interval_days" integer,
    "next_run_date" "date" NOT NULL,
    "end_date" "date",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "receipt_path" "text",
    "category_id" "text",
    "anchor_day" integer NOT NULL,
    "paused" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    CONSTRAINT "expense_recurrences_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expense_recurrences_anchor_day_check" CHECK ((("anchor_day" >= 1) AND ("anchor_day" <= 31))),
    CONSTRAINT "expense_recurrences_category_key_check" CHECK ((("category_id" IS NULL) OR ("category_id" = ANY (ARRAY['alimentacao'::"text", 'bebidas'::"text", 'transporte'::"text", 'hospedagem'::"text", 'lazer'::"text", 'compras'::"text", 'contas'::"text", 'outros'::"text"])))),
    CONSTRAINT "expense_recurrences_freq_check" CHECK (("freq" = ANY (ARRAY['daily'::"text", 'weekly'::"text", 'monthly'::"text", 'yearly'::"text", 'custom'::"text"]))),
    CONSTRAINT "expense_recurrences_interval_days_check" CHECK (("interval_days" > 0)),
    CONSTRAINT "expense_recurrences_split_type_check" CHECK (("split_type" = ANY (ARRAY['equal'::"text", 'shares'::"text", 'exact'::"text"])))
);

ALTER TABLE "public"."expense_recurrences" OWNER TO "postgres";

COMMENT ON COLUMN "public"."expense_recurrences"."anchor_day" IS 'Dia do mês que ancora a série (o "Início" escolhido). Só usado por freq monthly/yearly.';

CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "amount" numeric(12,2) NOT NULL,
    "paid_by" "uuid" NOT NULL,
    "split_type" "text" DEFAULT 'equal'::"text" NOT NULL,
    "receipt_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "recurrence_id" "uuid",
    "category_id" "text",
    "date" "date" NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "expenses_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "expenses_category_key_check" CHECK ((("category_id" IS NULL) OR ("category_id" = ANY (ARRAY['alimentacao'::"text", 'bebidas'::"text", 'transporte'::"text", 'hospedagem'::"text", 'lazer'::"text", 'compras'::"text", 'contas'::"text", 'outros'::"text"])))),
    CONSTRAINT "expenses_split_type_check" CHECK (("split_type" = ANY (ARRAY['equal'::"text", 'shares'::"text", 'exact'::"text"])))
);

ALTER TABLE "public"."expenses" OWNER TO "postgres";

COMMENT ON COLUMN "public"."expenses"."date" IS 'Dia da despesa, escolhido no seletor. Use este campo pra exibir, ordenar e agrupar; created_at é só o instante da inserção.';

CREATE TABLE IF NOT EXISTS "public"."group_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "actor_name" "text" NOT NULL,
    "actor_avatar_path" "text",
    "at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "group_events_type_check" CHECK (("type" = ANY (ARRAY['expense_created'::"text", 'expense_edited'::"text", 'expense_deleted'::"text", 'settlement'::"text", 'member_joined'::"text", 'member_left'::"text", 'admin_changed'::"text", 'group_edited'::"text", 'group_created'::"text", 'recurrence_paused'::"text", 'recurrence_resumed'::"text", 'recurrence_edited'::"text"])))
);

ALTER TABLE "public"."group_events" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"])))
);

ALTER TABLE "public"."group_members" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "from_user" "uuid" NOT NULL,
    "to_user" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "description" "text",
    "receipt_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payments_check" CHECK (("from_user" <> "to_user"))
);

ALTER TABLE "public"."payments" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "avatar_key" "text",
    "whatsapp" "text",
    "is_premium" boolean DEFAULT false NOT NULL,
    "premium_since" timestamp with time zone,
    "onboarding_answers" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "avatar_path" "text",
    "language" "text" DEFAULT 'pt-BR'::"text" NOT NULL,
    "timezone" "text",
    "pix_key" "text",
    "pix_key_type" "text",
    CONSTRAINT "profiles_pix_key_pair_check" CHECK ((("pix_key" IS NULL) = ("pix_key_type" IS NULL))),
    CONSTRAINT "profiles_pix_key_type_check" CHECK (("pix_key_type" = ANY (ARRAY['cpf'::"text", 'email'::"text", 'phone'::"text", 'random'::"text"])))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."push_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "kind" "text" NOT NULL,
    "group_id" "uuid",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."push_log" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."push_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."push_tokens" OWNER TO "postgres";

CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "from_user" "uuid" NOT NULL,
    "to_user" "uuid" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'marked_paid'::"text" NOT NULL,
    "marked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_at" timestamp with time zone,
    "proof_path" "text",
    "recorded_by_creditor" boolean DEFAULT false NOT NULL,
    CONSTRAINT "settlements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "settlements_check" CHECK (("from_user" <> "to_user")),
    CONSTRAINT "settlements_status_check" CHECK (("status" = ANY (ARRAY['marked_paid'::"text", 'confirmed'::"text"])))
);

ALTER TABLE "public"."settlements" OWNER TO "postgres";

COMMENT ON COLUMN "public"."settlements"."recorded_by_creditor" IS 'true quando foi o credor quem registrou o recebimento (record_receipt), em vez de o devedor ter marcado como pago.';

ALTER TABLE ONLY "public"."expense_participants"
    ADD CONSTRAINT "expense_participants_pkey" PRIMARY KEY ("expense_id", "user_id");

ALTER TABLE ONLY "public"."expense_recurrences"
    ADD CONSTRAINT "expense_recurrences_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("group_id", "user_id");

ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_invite_code_key" UNIQUE ("invite_code");

ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."push_log"
    ADD CONSTRAINT "push_log_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_token_key" UNIQUE ("user_id", "token");

ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");

CREATE INDEX "expense_participants_user_id_idx" ON "public"."expense_participants" USING "btree" ("user_id");

CREATE INDEX "expense_recurrences_active_next_run_idx" ON "public"."expense_recurrences" USING "btree" ("next_run_date") WHERE "active";

CREATE INDEX "expense_recurrences_group_id_idx" ON "public"."expense_recurrences" USING "btree" ("group_id");

CREATE INDEX "expenses_category_id_idx" ON "public"."expenses" USING "btree" ("category_id");

CREATE INDEX "expenses_group_id_idx" ON "public"."expenses" USING "btree" ("group_id");

CREATE INDEX "expenses_recurrence_id_idx" ON "public"."expenses" USING "btree" ("recurrence_id");

CREATE INDEX "group_events_group_id_at_idx" ON "public"."group_events" USING "btree" ("group_id", "at" DESC);

CREATE INDEX "group_members_user_id_idx" ON "public"."group_members" USING "btree" ("user_id");

CREATE INDEX "payments_group_id_idx" ON "public"."payments" USING "btree" ("group_id");

CREATE INDEX "push_log_recipient_kind_created_idx" ON "public"."push_log" USING "btree" ("recipient_id", "kind", "created_at" DESC);

CREATE INDEX "push_tokens_user_id_idx" ON "public"."push_tokens" USING "btree" ("user_id");

CREATE INDEX "settlements_group_id_idx" ON "public"."settlements" USING "btree" ("group_id");

CREATE OR REPLACE TRIGGER "expense_recurrences_set_anchor_day" BEFORE INSERT ON "public"."expense_recurrences" FOR EACH ROW EXECUTE FUNCTION "public"."set_recurrence_anchor_day"();

CREATE OR REPLACE TRIGGER "expenses_set_date" BEFORE INSERT ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_expense_date"();

CREATE OR REPLACE TRIGGER "group_members_enforce_role_limit" BEFORE INSERT OR UPDATE OF "archived_at" ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_role_limit"();

CREATE OR REPLACE TRIGGER "on_admin_role_changed_history" AFTER UPDATE OF "role" ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_admin_role_changed_history"();

CREATE OR REPLACE TRIGGER "on_expense_deleted_history" AFTER DELETE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."log_expense_deleted_history"();

CREATE OR REPLACE TRIGGER "on_expense_participants_history" AFTER INSERT ON "public"."expense_participants" REFERENCING NEW TABLE AS "new_participants" FOR EACH STATEMENT EXECUTE FUNCTION "public"."log_expense_history"();

CREATE OR REPLACE TRIGGER "on_expense_participants_inserted" AFTER INSERT ON "public"."expense_participants" REFERENCING NEW TABLE AS "new_participants" FOR EACH STATEMENT EXECUTE FUNCTION "public"."notify_expense_participants"();

CREATE OR REPLACE TRIGGER "on_group_created_history" AFTER INSERT ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."log_group_created_history"();

CREATE OR REPLACE TRIGGER "on_group_edited" AFTER UPDATE OF "name", "avatar_key", "avatar_path" ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."notify_group_edited"();

CREATE OR REPLACE TRIGGER "on_group_edited_history" AFTER UPDATE OF "name", "avatar_key", "avatar_path" ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."log_group_edited_history"();

CREATE OR REPLACE TRIGGER "on_group_member_deleted" AFTER DELETE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."promote_oldest_after_admin_leaves"();

CREATE OR REPLACE TRIGGER "on_group_member_joined" AFTER INSERT ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_member_joined"();

CREATE OR REPLACE TRIGGER "on_group_member_left" AFTER DELETE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_member_left"();

CREATE OR REPLACE TRIGGER "on_group_member_role_changed" AFTER UPDATE OF "role" ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."notify_admin_role_changed"();

CREATE OR REPLACE TRIGGER "on_member_joined_history" AFTER INSERT ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_member_joined_history"();

CREATE OR REPLACE TRIGGER "on_member_left_history" AFTER DELETE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_member_left_history"();

CREATE OR REPLACE TRIGGER "on_member_left_pause_recurrences" AFTER DELETE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."pause_recurrences_of_departed_member"();

CREATE OR REPLACE TRIGGER "on_recurrence_edited_history" AFTER UPDATE OF "paused", "freq", "interval_days", "end_date" ON "public"."expense_recurrences" FOR EACH ROW EXECUTE FUNCTION "public"."log_recurrence_history"();

CREATE OR REPLACE TRIGGER "on_settlement_confirmed" AFTER UPDATE ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."notify_settlement_confirmed"();

CREATE OR REPLACE TRIGGER "on_settlement_confirmed_history" AFTER UPDATE ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."log_settlement_confirmed_history"();

CREATE OR REPLACE TRIGGER "on_settlement_marked_paid" AFTER INSERT ON "public"."settlements" FOR EACH ROW EXECUTE FUNCTION "public"."notify_settlement_marked_paid"();

ALTER TABLE ONLY "public"."expense_participants"
    ADD CONSTRAINT "expense_participants_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expense_participants"
    ADD CONSTRAINT "expense_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."expense_recurrences"
    ADD CONSTRAINT "expense_recurrences_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."expense_recurrences"
    ADD CONSTRAINT "expense_recurrences_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expense_recurrences"
    ADD CONSTRAINT "expense_recurrences_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "public"."expense_recurrences"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."group_events"
    ADD CONSTRAINT "group_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."push_log"
    ADD CONSTRAINT "push_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."push_log"
    ADD CONSTRAINT "push_log_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."push_log"
    ADD CONSTRAINT "push_log_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."push_tokens"
    ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."profiles"("id");
