-- ═══════════════════════════════════════════════════════════════════════════
-- 0108 — RLS, políticas e permissões
--
-- Quem enxerga e quem escreve cada linha. É a camada que impede um rolê
-- de ver o outro.
--
-- Conjunto ESSENCIAL: reconstruído do schema que está em produção, não da
-- sequência histórica. Sem coluna que nasceu e morreu, sem função redefinida
-- 18 vezes. O porquê de cada decisão está em supabase/migrations_archive/.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "public"."expense_participants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_participants_delete_payer_creator_or_admin" ON "public"."expense_participants" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_participants"."expense_id") AND (("e"."paid_by" = "auth"."uid"()) OR ("e"."created_by" = "auth"."uid"()) OR "public"."is_group_admin"("e"."group_id"))))));

CREATE POLICY "expense_participants_insert_member" ON "public"."expense_participants" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_participants"."expense_id") AND "public"."is_group_member"("e"."group_id")))));

CREATE POLICY "expense_participants_select_member" ON "public"."expense_participants" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_participants"."expense_id") AND "public"."is_group_member"("e"."group_id")))));

CREATE POLICY "expense_participants_update_payer_creator_or_admin" ON "public"."expense_participants" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_participants"."expense_id") AND (("e"."paid_by" = "auth"."uid"()) OR ("e"."created_by" = "auth"."uid"()) OR "public"."is_group_admin"("e"."group_id"))))));

ALTER TABLE "public"."expense_recurrences" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_recurrences_delete_owner_or_admin" ON "public"."expense_recurrences" FOR DELETE USING ((("created_by" = "auth"."uid"()) OR "public"."is_group_admin"("group_id")));

CREATE POLICY "expense_recurrences_insert_premium_member" ON "public"."expense_recurrences" FOR INSERT WITH CHECK (("public"."is_group_member"("group_id") AND COALESCE(( SELECT "profiles"."is_premium"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())), false)));

CREATE POLICY "expense_recurrences_select_member" ON "public"."expense_recurrences" FOR SELECT USING ("public"."is_group_member"("group_id"));

CREATE POLICY "expense_recurrences_update_owner_or_admin" ON "public"."expense_recurrences" FOR UPDATE USING ((("created_by" = "auth"."uid"()) OR "public"."is_group_admin"("group_id"))) WITH CHECK ("public"."is_group_member"("group_id"));

ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_delete_payer_creator_or_admin" ON "public"."expenses" FOR DELETE USING ((("paid_by" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR "public"."is_group_admin"("group_id")));

CREATE POLICY "expenses_insert_member" ON "public"."expenses" FOR INSERT WITH CHECK ("public"."is_group_member"("group_id"));

CREATE POLICY "expenses_select_member" ON "public"."expenses" FOR SELECT USING ("public"."is_group_member"("group_id"));

CREATE POLICY "expenses_update_payer_creator_or_admin" ON "public"."expenses" FOR UPDATE USING ((("paid_by" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()) OR "public"."is_group_admin"("group_id"))) WITH CHECK ("public"."is_group_member"("group_id"));

ALTER TABLE "public"."group_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_events_select_member" ON "public"."group_events" FOR SELECT USING ("public"."is_group_member"("group_id"));

ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_delete_self_or_admin" ON "public"."group_members" FOR DELETE USING ((("user_id" = "auth"."uid"()) OR ("public"."is_group_owner"("group_id") AND ("role" = ANY (ARRAY['admin'::"text", 'member'::"text"]))) OR ("public"."is_group_admin"("group_id") AND ("role" = 'member'::"text"))));

CREATE POLICY "group_members_insert_self_or_admin" ON "public"."group_members" FOR INSERT WITH CHECK ((("user_id" = "auth"."uid"()) OR "public"."is_group_admin"("group_id")));

CREATE POLICY "group_members_select_member" ON "public"."group_members" FOR SELECT USING ("public"."is_group_member"("group_id"));

CREATE POLICY "group_members_update_promote" ON "public"."group_members" FOR UPDATE USING (("public"."is_group_admin"("group_id") AND ("role" = 'member'::"text"))) WITH CHECK (("role" = 'admin'::"text"));

ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_delete_admin" ON "public"."groups" FOR DELETE USING ("public"."is_group_admin"("id"));

CREATE POLICY "groups_insert_own" ON "public"."groups" FOR INSERT WITH CHECK (("created_by" = "auth"."uid"()));

CREATE POLICY "groups_select_member" ON "public"."groups" FOR SELECT USING (("public"."is_group_member"("id") OR ("created_by" = "auth"."uid"())));

CREATE POLICY "groups_update_admin" ON "public"."groups" FOR UPDATE USING ("public"."is_group_admin"("id")) WITH CHECK ("public"."is_group_admin"("id"));

ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_delete_party_or_admin" ON "public"."payments" FOR DELETE USING ((("from_user" = "auth"."uid"()) OR ("to_user" = "auth"."uid"()) OR "public"."is_group_admin"("group_id")));

CREATE POLICY "payments_insert_party" ON "public"."payments" FOR INSERT WITH CHECK (("public"."is_group_member"("group_id") AND (("from_user" = "auth"."uid"()) OR ("to_user" = "auth"."uid"()))));

CREATE POLICY "payments_select_member" ON "public"."payments" FOR SELECT USING ("public"."is_group_member"("group_id"));

CREATE POLICY "payments_update_party_or_admin" ON "public"."payments" FOR UPDATE USING ((("from_user" = "auth"."uid"()) OR ("to_user" = "auth"."uid"()) OR "public"."is_group_admin"("group_id"))) WITH CHECK ("public"."is_group_member"("group_id"));

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = "auth"."uid"()));

CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT USING (("id" = "auth"."uid"()));

CREATE POLICY "profiles_select_shared_group" ON "public"."profiles" FOR SELECT USING ("public"."shares_group_with"("id"));

CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));

ALTER TABLE "public"."push_log" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."push_tokens" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_delete_own" ON "public"."push_tokens" FOR DELETE USING (("user_id" = "auth"."uid"()));

CREATE POLICY "push_tokens_insert_own" ON "public"."push_tokens" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));

CREATE POLICY "push_tokens_select_own" ON "public"."push_tokens" FOR SELECT USING (("user_id" = "auth"."uid"()));

CREATE POLICY "push_tokens_update_own" ON "public"."push_tokens" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));

ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_delete_debtor_undo" ON "public"."settlements" FOR DELETE USING ((("from_user" = "auth"."uid"()) AND ("status" = 'marked_paid'::"text")));

CREATE POLICY "settlements_insert_debtor" ON "public"."settlements" FOR INSERT WITH CHECK (("public"."is_group_member"("group_id") AND ("from_user" = "auth"."uid"()) AND ("status" = 'marked_paid'::"text")));

CREATE POLICY "settlements_select_member" ON "public"."settlements" FOR SELECT USING ("public"."is_group_member"("group_id"));

CREATE POLICY "settlements_update_creditor_confirms" ON "public"."settlements" FOR UPDATE USING ((("to_user" = "auth"."uid"()) AND ("status" = 'marked_paid'::"text"))) WITH CHECK ((("to_user" = "auth"."uid"()) AND ("status" = 'confirmed'::"text")));

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "anon";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON FUNCTION "public"."add_months_clamped"("p_from" "date", "p_months" integer, "p_anchor_day" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."add_months_clamped"("p_from" "date", "p_months" integer, "p_anchor_day" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."add_months_clamped"("p_from" "date", "p_months" integer, "p_anchor_day" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."confirm_settlement"("p_settlement_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."confirm_settlement"("p_settlement_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."confirm_settlement"("p_settlement_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_expense_with_participants"("p_id" "uuid", "p_group_id" "uuid", "p_title" "text", "p_category_id" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_description" "text", "p_receipt_path" "text", "p_recurrence_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."create_expense_with_participants"("p_id" "uuid", "p_group_id" "uuid", "p_title" "text", "p_category_id" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_description" "text", "p_receipt_path" "text", "p_recurrence_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."create_expense_with_participants"("p_id" "uuid", "p_group_id" "uuid", "p_title" "text", "p_category_id" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_description" "text", "p_receipt_path" "text", "p_recurrence_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "anon";

GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."generate_invite_code"() TO "service_role";

GRANT ALL ON TABLE "public"."groups" TO "anon";

GRANT ALL ON TABLE "public"."groups" TO "authenticated";

GRANT ALL ON TABLE "public"."groups" TO "service_role";

GRANT ALL ON FUNCTION "public"."create_group_with_owner"("p_name" "text", "p_avatar_key" "text", "p_default_split_type" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."create_group_with_owner"("p_name" "text", "p_avatar_key" "text", "p_default_split_type" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."create_group_with_owner"("p_name" "text", "p_avatar_key" "text", "p_default_split_type" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_kind" "text", "p_family" "text", "p_title" "text", "p_context" "text", "p_href" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_actor_avatar_path" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_kind" "text", "p_family" "text", "p_title" "text", "p_context" "text", "p_href" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_actor_avatar_path" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_kind" "text", "p_family" "text", "p_title" "text", "p_context" "text", "p_href" "text", "p_actor_id" "uuid", "p_actor_name" "text", "p_actor_avatar_path" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "service_role";

REVOKE ALL ON FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."demote_admin"("gid" "uuid", "target_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."enforce_role_limit"() TO "anon";

GRANT ALL ON FUNCTION "public"."enforce_role_limit"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."enforce_role_limit"() TO "service_role";

REVOKE ALL ON FUNCTION "public"."find_group_by_invite_code"("code" "text") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("code" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("code" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."find_group_by_invite_code"("code" "text") TO "service_role";

GRANT ALL ON FUNCTION "public"."group_last_activity"("p_group_ids" "uuid"[]) TO "anon";

GRANT ALL ON FUNCTION "public"."group_last_activity"("p_group_ids" "uuid"[]) TO "authenticated";

GRANT ALL ON FUNCTION "public"."group_last_activity"("p_group_ids" "uuid"[]) TO "service_role";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT ALL ON FUNCTION "public"."is_group_admin"("gid" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."is_group_admin"("gid" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_group_admin"("gid" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_group_member"("gid" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."is_group_owner"("gid" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."log_admin_role_changed_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_admin_role_changed_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_admin_role_changed_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_expense_deleted_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_expense_deleted_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_expense_deleted_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_expense_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_expense_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_expense_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_group_created_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_group_created_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_group_created_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_group_edited_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_group_edited_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_group_edited_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_member_joined_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_member_joined_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_member_joined_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_member_left_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_member_left_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_member_left_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_recurrence_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_recurrence_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_recurrence_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."log_settlement_confirmed_history"() TO "anon";

GRANT ALL ON FUNCTION "public"."log_settlement_confirmed_history"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."log_settlement_confirmed_history"() TO "service_role";

GRANT ALL ON FUNCTION "public"."materialize_recurring_expenses"("p_recurrence_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."materialize_recurring_expenses"("p_recurrence_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."materialize_recurring_expenses"("p_recurrence_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."next_recurrence_date"("p_from" "date", "p_freq" "text", "p_interval_days" integer, "p_anchor_day" integer) TO "anon";

GRANT ALL ON FUNCTION "public"."next_recurrence_date"("p_from" "date", "p_freq" "text", "p_interval_days" integer, "p_anchor_day" integer) TO "authenticated";

GRANT ALL ON FUNCTION "public"."next_recurrence_date"("p_from" "date", "p_freq" "text", "p_interval_days" integer, "p_anchor_day" integer) TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_admin_role_changed"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_admin_role_changed"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_admin_role_changed"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_expense_participants"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_expense_participants"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_expense_participants"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_group_edited"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_group_edited"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_group_edited"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_member_joined"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_member_joined"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_member_joined"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_member_left"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_member_left"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_member_left"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_open_balances"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_open_balances"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_open_balances"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_settlement_confirmed"() TO "service_role";

GRANT ALL ON FUNCTION "public"."notify_settlement_marked_paid"() TO "anon";

GRANT ALL ON FUNCTION "public"."notify_settlement_marked_paid"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."notify_settlement_marked_paid"() TO "service_role";

GRANT ALL ON FUNCTION "public"."pause_recurrences_of_departed_member"() TO "anon";

GRANT ALL ON FUNCTION "public"."pause_recurrences_of_departed_member"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."pause_recurrences_of_departed_member"() TO "service_role";

GRANT ALL ON FUNCTION "public"."promote_oldest_after_admin_leaves"() TO "anon";

GRANT ALL ON FUNCTION "public"."promote_oldest_after_admin_leaves"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."promote_oldest_after_admin_leaves"() TO "service_role";

GRANT ALL ON FUNCTION "public"."record_receipt"("p_group_id" "uuid", "p_from_user" "uuid", "p_amount" numeric) TO "anon";

GRANT ALL ON FUNCTION "public"."record_receipt"("p_group_id" "uuid", "p_from_user" "uuid", "p_amount" numeric) TO "authenticated";

GRANT ALL ON FUNCTION "public"."record_receipt"("p_group_id" "uuid", "p_from_user" "uuid", "p_amount" numeric) TO "service_role";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";

GRANT ALL ON FUNCTION "public"."send_push_event"("p_recipient_id" "uuid", "p_actor_id" "uuid", "p_kind" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "anon";

GRANT ALL ON FUNCTION "public"."send_push_event"("p_recipient_id" "uuid", "p_actor_id" "uuid", "p_kind" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "authenticated";

GRANT ALL ON FUNCTION "public"."send_push_event"("p_recipient_id" "uuid", "p_actor_id" "uuid", "p_kind" "text", "p_group_id" "uuid", "p_metadata" "jsonb") TO "service_role";

GRANT ALL ON FUNCTION "public"."set_expense_date"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_expense_date"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_expense_date"() TO "service_role";

GRANT ALL ON FUNCTION "public"."set_group_avatar_on_create"("p_group_id" "uuid", "p_path" "text") TO "anon";

GRANT ALL ON FUNCTION "public"."set_group_avatar_on_create"("p_group_id" "uuid", "p_path" "text") TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_group_avatar_on_create"("p_group_id" "uuid", "p_path" "text") TO "service_role";

REVOKE ALL ON FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) TO "anon";

GRANT ALL ON FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_my_group_archived"("gid" "uuid", "archived" boolean) TO "service_role";

GRANT ALL ON FUNCTION "public"."set_recurrence_anchor_day"() TO "anon";

GRANT ALL ON FUNCTION "public"."set_recurrence_anchor_day"() TO "authenticated";

GRANT ALL ON FUNCTION "public"."set_recurrence_anchor_day"() TO "service_role";

GRANT ALL ON FUNCTION "public"."shares_group_with"("other" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."shares_group_with"("other" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."shares_group_with"("other" "uuid") TO "service_role";

REVOKE ALL ON FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") FROM PUBLIC;

GRANT ALL ON FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."transfer_owner"("gid" "uuid", "new_owner_user_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."update_expense_with_participants"("p_id" "uuid", "p_title" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_category_id" "text", "p_receipt_path" "text", "p_set_recurrence" boolean, "p_recurrence_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."update_expense_with_participants"("p_id" "uuid", "p_title" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_category_id" "text", "p_receipt_path" "text", "p_set_recurrence" boolean, "p_recurrence_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."update_expense_with_participants"("p_id" "uuid", "p_title" "text", "p_amount" numeric, "p_paid_by" "uuid", "p_split_type" "text", "p_date" "date", "p_participants" "jsonb", "p_category_id" "text", "p_receipt_path" "text", "p_set_recurrence" boolean, "p_recurrence_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."user_group_balance"("p_user_id" "uuid", "p_group_id" "uuid") TO "anon";

GRANT ALL ON FUNCTION "public"."user_group_balance"("p_user_id" "uuid", "p_group_id" "uuid") TO "authenticated";

GRANT ALL ON FUNCTION "public"."user_group_balance"("p_user_id" "uuid", "p_group_id" "uuid") TO "service_role";

GRANT ALL ON TABLE "public"."expense_participants" TO "anon";

GRANT ALL ON TABLE "public"."expense_participants" TO "authenticated";

GRANT ALL ON TABLE "public"."expense_participants" TO "service_role";

GRANT ALL ON TABLE "public"."expense_recurrences" TO "anon";

GRANT ALL ON TABLE "public"."expense_recurrences" TO "authenticated";

GRANT ALL ON TABLE "public"."expense_recurrences" TO "service_role";

GRANT ALL ON TABLE "public"."expenses" TO "anon";

GRANT ALL ON TABLE "public"."expenses" TO "authenticated";

GRANT ALL ON TABLE "public"."expenses" TO "service_role";

GRANT ALL ON TABLE "public"."group_events" TO "anon";

GRANT ALL ON TABLE "public"."group_events" TO "authenticated";

GRANT ALL ON TABLE "public"."group_events" TO "service_role";

GRANT ALL ON TABLE "public"."group_members" TO "anon";

GRANT ALL ON TABLE "public"."group_members" TO "authenticated";

GRANT ALL ON TABLE "public"."group_members" TO "service_role";

GRANT ALL ON TABLE "public"."payments" TO "anon";

GRANT ALL ON TABLE "public"."payments" TO "authenticated";

GRANT ALL ON TABLE "public"."payments" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";

GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."profiles" TO "service_role";

GRANT UPDATE("name") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("avatar_key") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("whatsapp") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("onboarding_answers") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("avatar_path") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("language") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("timezone") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("pix_key") ON TABLE "public"."profiles" TO "authenticated";

GRANT UPDATE("pix_key_type") ON TABLE "public"."profiles" TO "authenticated";

GRANT ALL ON TABLE "public"."push_log" TO "anon";

GRANT ALL ON TABLE "public"."push_log" TO "authenticated";

GRANT ALL ON TABLE "public"."push_log" TO "service_role";

GRANT ALL ON TABLE "public"."push_tokens" TO "anon";

GRANT ALL ON TABLE "public"."push_tokens" TO "authenticated";

GRANT ALL ON TABLE "public"."push_tokens" TO "service_role";

GRANT ALL ON TABLE "public"."settlements" TO "anon";

GRANT ALL ON TABLE "public"."settlements" TO "authenticated";

GRANT ALL ON TABLE "public"."settlements" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
