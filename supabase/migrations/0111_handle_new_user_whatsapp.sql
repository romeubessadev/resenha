-- O gatilho de criação de perfil descartava o WhatsApp.
--
-- `app/(pre-auth)/signup.tsx` manda os três campos no metadata do signUp:
--   options: { data: { name, whatsapp, language } }
-- mas `handle_new_user` só lia `name` e `language`. O número era pedido no
-- cadastro, viajava até `auth.users.raw_user_meta_data` e morria ali —
-- `profiles.whatsapp` nascia NULL.
--
-- O efeito não aparece no cadastro: aparece depois, quando alguém da resenha
-- toca pra cobrar e o app não tem número pra abrir o WhatsApp. Como Ajustes
-- deixa preencher o número à mão, o campo se conserta sozinho para quem passa
-- por lá — e é por isso que isso sobreviveu sem ser notado.
--
-- `nullif(..., '')` porque a coluna é opcional: string vazia no metadata deve
-- virar NULL, e não um número em branco que passaria por preenchido.

create or replace function public.handle_new_user() returns trigger
    language plpgsql security definer
    set search_path to 'public'
    as $$
begin
  insert into public.profiles (id, name, whatsapp, language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    nullif(new.raw_user_meta_data ->> 'whatsapp', ''),
    coalesce(new.raw_user_meta_data ->> 'language', 'pt-BR')
  );
  return new;
end;
$$;

alter function public.handle_new_user() owner to postgres;

-- Repõe nos perfis já criados. Só onde está nulo: quem digitou o número em
-- Ajustes depois do cadastro tem o valor mais recente, e o metadata é o do dia
-- do cadastro — sobrescrever andaria pra trás.
update public.profiles p
   set whatsapp = nullif(u.raw_user_meta_data ->> 'whatsapp', '')
  from auth.users u
 where u.id = p.id
   and p.whatsapp is null
   and nullif(u.raw_user_meta_data ->> 'whatsapp', '') is not null;
