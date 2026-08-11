-- ═══════════════════════════════════════════════════════════════════════════
-- 0109 — Buckets e permissões de arquivo
--
-- Comprovante, foto de rolê, foto de perfil e comprovante de acerto.
-- NÃO vem do pg_dump: o schema `storage` é excluído do dump.
--
-- Conjunto ESSENCIAL: reconstruído do schema que está em produção, não da
-- sequência histórica. Sem coluna que nasceu e morreu, sem função redefinida
-- 18 vezes. O porquê de cada decisão está em supabase/migrations_archive/.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- Buckets de storage — NÃO vêm do pg_dump (schema `storage` é excluído)
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values
  ('avatares-grupo',    'avatares-grupo',    true),
  ('avatares-perfil',   'avatares-perfil',   true),
  ('comprovantes',      'comprovantes',      false),
  ('email-assets',      'email-assets',      true),
  ('settlement-proofs', 'settlement-proofs', false)
on conflict (id) do nothing;

-- ── Policies de storage.objects ────────────────────────────────────────────
-- `email-assets` não tem policy de propósito: é público e lido por URL.
drop policy if exists avatares_grupo_delete_member on storage.objects;

create policy avatares_grupo_delete_member on storage.objects as permissive for delete to public
  using (((bucket_id = 'avatares-grupo'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists avatares_grupo_insert_member on storage.objects;

create policy avatares_grupo_insert_member on storage.objects as permissive for insert to public
  with check (((bucket_id = 'avatares-grupo'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists avatares_grupo_select_member on storage.objects;

create policy avatares_grupo_select_member on storage.objects as permissive for select to public
  using (((bucket_id = 'avatares-grupo'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists avatares_perfil_delete_own on storage.objects;

create policy avatares_perfil_delete_own on storage.objects as permissive for delete to public
  using (((bucket_id = 'avatares-perfil'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));

drop policy if exists avatares_perfil_insert_own on storage.objects;

create policy avatares_perfil_insert_own on storage.objects as permissive for insert to public
  with check (((bucket_id = 'avatares-perfil'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));

drop policy if exists avatares_perfil_select_own on storage.objects;

create policy avatares_perfil_select_own on storage.objects as permissive for select to public
  using (((bucket_id = 'avatares-perfil'::text) AND (((storage.foldername(name))[1])::uuid = auth.uid())));

drop policy if exists comprovantes_delete_member on storage.objects;

create policy comprovantes_delete_member on storage.objects as permissive for delete to public
  using (((bucket_id = 'comprovantes'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists comprovantes_insert_member on storage.objects;

create policy comprovantes_insert_member on storage.objects as permissive for insert to public
  with check (((bucket_id = 'comprovantes'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists comprovantes_select_member on storage.objects;

create policy comprovantes_select_member on storage.objects as permissive for select to public
  using (((bucket_id = 'comprovantes'::text) AND public.is_group_member(((storage.foldername(name))[1])::uuid)));

drop policy if exists settlement_proofs_delete_party on storage.objects;

create policy settlement_proofs_delete_party on storage.objects as permissive for delete to public
  using (((bucket_id = 'settlement-proofs'::text) AND ((((storage.foldername(name))[2])::uuid = auth.uid()) OR (((storage.foldername(name))[3])::uuid = auth.uid()))));

drop policy if exists settlement_proofs_insert_party on storage.objects;

create policy settlement_proofs_insert_party on storage.objects as permissive for insert to public
  with check (((bucket_id = 'settlement-proofs'::text) AND ((((storage.foldername(name))[2])::uuid = auth.uid()) OR (((storage.foldername(name))[3])::uuid = auth.uid()))));

drop policy if exists settlement_proofs_select_party on storage.objects;

create policy settlement_proofs_select_party on storage.objects as permissive for select to public
  using (((bucket_id = 'settlement-proofs'::text) AND ((((storage.foldername(name))[2])::uuid = auth.uid()) OR (((storage.foldername(name))[3])::uuid = auth.uid()))));
