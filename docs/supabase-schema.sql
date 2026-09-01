-- ============================================================
-- Crava — schema do Supabase
-- Cole tudo isso no SQL Editor do Supabase e clique em RUN.
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- ============================================================

-- ---------- 1. Perfis (nome, @usuario, foto) ----------
create table if not exists public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default 'você',
  usuario     text unique,
  foto_url    text,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- ---------- 2. Dados do app (trabalhos, cofres, config, stats) ----------
-- Guardamos como JSON: é exatamente o formato que o app já usa,
-- então a sincronização é direta e sem risco de perder campo novo.
create table if not exists public.dados (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  payload       jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  dispositivo   text
);

-- ---------- 3. Segurança: cada um só enxerga o que é seu ----------
alter table public.perfis enable row level security;
alter table public.dados  enable row level security;

drop policy if exists "perfil proprio - ler"     on public.perfis;
drop policy if exists "perfil proprio - criar"   on public.perfis;
drop policy if exists "perfil proprio - alterar" on public.perfis;
create policy "perfil proprio - ler"     on public.perfis for select using (auth.uid() = id);
create policy "perfil proprio - criar"   on public.perfis for insert with check (auth.uid() = id);
create policy "perfil proprio - alterar" on public.perfis for update using (auth.uid() = id);

drop policy if exists "dados proprios - ler"     on public.dados;
drop policy if exists "dados proprios - criar"   on public.dados;
drop policy if exists "dados proprios - alterar" on public.dados;
create policy "dados proprios - ler"     on public.dados for select using (auth.uid() = user_id);
create policy "dados proprios - criar"   on public.dados for insert with check (auth.uid() = user_id);
create policy "dados proprios - alterar" on public.dados for update using (auth.uid() = user_id);

-- ---------- 4. Criar perfil e linha de dados automaticamente no cadastro ----------
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfis (id, nome, usuario)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'usuario', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.dados (user_id, payload)
  values (new.id, '{}'::jsonb)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

-- ---------- 5. Marcar a hora da última alteração ----------
create or replace function public.marcar_atualizacao()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists dados_atualizados on public.dados;
create trigger dados_atualizados before update on public.dados
  for each row execute function public.marcar_atualizacao();

drop trigger if exists perfis_atualizados on public.perfis;
create trigger perfis_atualizados before update on public.perfis
  for each row execute function public.marcar_atualizacao();

-- ---------- 6. Avatares (fotos de perfil) ----------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

drop policy if exists "avatar - ver todos"    on storage.objects;
drop policy if exists "avatar - enviar seu"   on storage.objects;
drop policy if exists "avatar - trocar seu"   on storage.objects;
create policy "avatar - ver todos"  on storage.objects for select
  using (bucket_id = 'avatares');
create policy "avatar - enviar seu" on storage.objects for insert
  with check (bucket_id = 'avatares' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "avatar - trocar seu" on storage.objects for update
  using (bucket_id = 'avatares' and auth.uid()::text = (storage.foldername(name))[1]);
