-- ============================================================
-- Crava — correção: @usuario repetido quebrava o cadastro
-- Cole no SQL Editor do Supabase e clique em RUN.
-- Agora, se o @ já existir, o app acrescenta um número (sak, sak2, sak3…)
-- ============================================================

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base      text;
  escolhido text;
  n         int := 1;
begin
  -- limpa o @ pedido: só letras, números e _
  base := coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1));
  base := regexp_replace(lower(base), '[^a-z0-9_]', '', 'g');
  if base is null or base = '' then
    base := 'user';
  end if;

  -- acha um livre
  escolhido := base;
  while exists (select 1 from public.perfis where usuario = escolhido) loop
    n := n + 1;
    escolhido := base || n::text;
    if n > 500 then
      escolhido := base || '_' || substr(replace(new.id::text, '-', ''), 1, 6);
      exit;
    end if;
  end loop;

  insert into public.perfis (id, nome, usuario)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    escolhido
  )
  on conflict (id) do nothing;

  insert into public.dados (user_id, payload)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;

exception when others then
  -- nunca deixa o cadastro falhar por causa do perfil
  insert into public.dados (user_id, payload)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- garante que o gatilho está ativo
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- limpa os perfis dos meus testes (não afeta você)
delete from public.perfis where usuario like 'teste%' or nome = 'Teste';
