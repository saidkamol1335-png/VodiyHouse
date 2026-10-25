-- Заглушка той части Supabase, на которую опираются наши миграции и политики RLS.
-- Только для тестов в PGlite (решение фазы 1, вопрос 1): облако даёт это само.
-- Расхождение с облаком ловит прогон тех же тестов против vodiyhouse-dev перед приёмкой.

-- Роли Data API. service_role обходит RLS, как в облаке.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- id без default, как в облаке: его выдаёт Auth — тесты обязаны передавать его сами.
create table auth.users (
  id uuid primary key,
  email text unique,
  raw_app_meta_data jsonb not null default '{}',
  raw_user_meta_data jsonb not null default '{}',
  -- Есть в облаке; читает public.staff_directory() (шаг 8).
  last_sign_in_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Те же определения, что у Supabase: id и роль берутся из claims JWT текущего запроса.
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    auth.jwt() ->> 'sub'
  )::uuid
$$;

create function auth.role() returns text
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), auth.jwt() ->> 'role')
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;

create schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;

-- Storage: только таблицы, на которые опираются наши политики. Как в облаке, строки
-- objects пишет сам сервис Storage от имени пользователя — права ролям API открыты, защищает RLS.
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  owner uuid,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text,
  owner uuid,
  metadata jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

-- Права по умолчанию — как в облачном проекте vodiyhouse-dev (pg_default_acl, проверено 2.9б):
-- всё новое в public открыто anon, authenticated и service_role, защищает только RLS. Миграции
-- обязаны сами отзывать лишнее — тесты это проверяют. Права сервера на таблицы закрывает
-- 20261024170000_service_role_tables.sql — с ней забытый grant для сервера виден уже здесь.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
