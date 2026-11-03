-- Проект-2, фаза D (PLAN §10, пп. 8, 28): второй фактор руководителя.
--   Права head база выдаёт только сессии, прошедшей второй фактор не раньше 30 дней назад: в JWT
--   aal = 'aal2' и в amr — totp со свежей отметкой времени. Иначе, зная пароль, можно было бы войти
--   через Supabase Auth напрямую и работать с правами руководителя через Data API.
--   Механизм — TOTP-фактор Supabase MFA, секрет которого хранит сервер админки: человек получает
--   одноразовый код в Telegram (или вводит запасной), сервер проверяет его здесь и сам подтверждает
--   TOTP — aal2 в токен ставит только Auth. Всё ниже, кроме staff_role, — только сервер (service_role).

-- ─── Права: руководитель — только со свежим вторым фактором ──────────────────────────────
create function private.head_factor_fresh()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (
       select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
       where a ->> 'method' = 'totp'
         and (a ->> 'timestamp')::bigint > extract(epoch from now() - interval '30 days')
     );
$$;

-- Тело — из 20261029050000_staff_sessions.sql, добавлено одно условие.
create or replace function private.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and not p.must_change_password
    and (p.sessions_revoked_at is null
         or coalesce((auth.jwt() ->> 'iat')::bigint, 0) > floor(extract(epoch from p.sessions_revoked_at)))
    and (p.role <> 'head' or private.head_factor_fresh())
$$;

comment on function private.staff_role() is
  'Роль текущего сотрудника; null — посетитель, чужой, отключённый, ещё не сменивший временный пароль, токен старше закрытия сессий или руководитель без второго фактора за последние 30 дней.';

-- ─── Хранилище второго фактора (схема private — Data API её не видит) ────────────────────
-- Чат Telegram сотрудника: привязка через /start бота; перепривязка — только сбросом (staff:reset-2fa).
create table private.staff_telegram (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  chat_id bigint not null,
  linked_at timestamptz not null default now()
);

-- Ссылка привязки t.me/<бот>?start=h_<токен>: в базе — хэш, живёт 15 минут.
create table private.staff_telegram_links (
  token_hash text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null
);

-- TOTP-фактор Supabase MFA и его секрет (base32) — сервер считает код сам.
create table private.head_totp (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  factor_id uuid not null,
  secret text not null check (secret ~ '^[A-Z2-7]+=*$'),
  created_at timestamptz not null default now()
);

-- Одноразовый код входа из Telegram: 10 минут, 5 попыток.
create table private.head_codes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0,
  sent_at timestamptz not null default now()
);

-- 10 запасных кодов: показываются один раз, в базе — хэши.
create table private.head_backup_codes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null,
  used_at timestamptz,
  primary key (user_id, code_hash)
);

revoke all on private.staff_telegram, private.staff_telegram_links, private.head_totp,
  private.head_codes, private.head_backup_codes from public, anon, authenticated;

-- ─── Функции сервера ─────────────────────────────────────────────────────────────────────
-- Что есть у руководителя: привязан ли Telegram, есть ли фактор и сколько запасных кодов осталось.
create function public.head_factor_state(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'telegram', exists (select 1 from private.staff_telegram t where t.user_id = p_user),
    'factor_id', (select h.factor_id from private.head_totp h where h.user_id = p_user),
    'backup_left', (select count(*) from private.head_backup_codes b where b.user_id = p_user and b.used_at is null)
  );
$$;

-- Ссылка привязки — только пока Telegram не привязан (иначе знающий пароль перепривязал бы себе).
create function public.create_staff_telegram_link(p_user uuid, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.staff_telegram t where t.user_id = p_user) then
    return false;
  end if;
  delete from private.staff_telegram_links l where l.user_id = p_user or l.expires_at < now();
  insert into private.staff_telegram_links (token_hash, user_id, expires_at)
  values (p_token_hash, p_user, now() + interval '15 minutes');
  return true;
end;
$$;

-- /start h_<токен> в боте: привязать чат. null — ссылка устарела или уже использована.
create function public.complete_staff_telegram_link(p_token_hash text, p_chat bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  delete from private.staff_telegram_links l
    where l.token_hash = p_token_hash and l.expires_at > now()
    returning l.user_id into v_user;
  if v_user is null then
    return null;
  end if;
  insert into private.staff_telegram (user_id, chat_id) values (v_user, p_chat)
    on conflict (user_id) do nothing;
  return v_user;
end;
$$;

create function public.staff_telegram_chat(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select t.chat_id from private.staff_telegram t where t.user_id = p_user;
$$;

create function public.head_totp_secret(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('factor_id', h.factor_id, 'secret', h.secret)
  from private.head_totp h where h.user_id = p_user;
$$;

create function public.save_head_totp(p_user uuid, p_factor uuid, p_secret text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into private.head_totp (user_id, factor_id, secret) values (p_user, p_factor, p_secret)
  on conflict (user_id) do update set factor_id = excluded.factor_id, secret = excluded.secret, created_at = now();
$$;

-- Новый код входа — не чаще раза в минуту (иначе бот завалит чат). false — рано.
create function public.issue_head_code(p_user uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from private.head_codes c where c.user_id = p_user and c.sent_at > now() - interval '1 minute') then
    return false;
  end if;
  insert into private.head_codes (user_id, code_hash, expires_at)
  values (p_user, p_code_hash, now() + interval '10 minutes')
  on conflict (user_id) do update
    set code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0, sent_at = now();
  return true;
end;
$$;

-- Проверка кода: верный — код сгорает; 5 неверных — код сгорает, нужен новый.
create function public.check_head_code(p_user uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code private.head_codes;
begin
  select * into v_code from private.head_codes c where c.user_id = p_user for update;
  if v_code.user_id is null or v_code.expires_at < now() or v_code.attempts >= 5 then
    return false;
  end if;
  if v_code.code_hash = p_code_hash then
    delete from private.head_codes c where c.user_id = p_user;
    return true;
  end if;
  update private.head_codes c set attempts = c.attempts + 1 where c.user_id = p_user;
  return false;
end;
$$;

-- Запасные коды заменяются целиком (прежние, и неиспользованные, больше не действуют).
create function public.save_head_backup_codes(p_user uuid, p_hashes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.head_backup_codes b where b.user_id = p_user;
  insert into private.head_backup_codes (user_id, code_hash)
  select p_user, h from unnest(p_hashes) h;
end;
$$;

create function public.use_head_backup_code(p_user uuid, p_code_hash text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with used as (
    update private.head_backup_codes b set used_at = now()
    where b.user_id = p_user and b.code_hash = p_code_hash and b.used_at is null
    returning 1
  )
  select exists (select 1 from used);
$$;

-- Сброс разработчиком (npm run staff:reset-2fa): Telegram, фактор, коды и все сессии сотрудника.
-- Факторы в Auth удаляет скрипт.
create function public.reset_head_second_factor(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from private.staff_telegram t where t.user_id = p_user;
  delete from private.staff_telegram_links l where l.user_id = p_user;
  delete from private.head_totp h where h.user_id = p_user;
  delete from private.head_codes c where c.user_id = p_user;
  delete from private.head_backup_codes b where b.user_id = p_user;
  perform private.end_staff_sessions(p_user);
end;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'head_factor_state(uuid)', 'create_staff_telegram_link(uuid, text)',
    'complete_staff_telegram_link(text, bigint)', 'staff_telegram_chat(uuid)', 'head_totp_secret(uuid)',
    'save_head_totp(uuid, uuid, text)', 'issue_head_code(uuid, text)', 'check_head_code(uuid, text)',
    'save_head_backup_codes(uuid, text[])', 'use_head_backup_code(uuid, text)', 'reset_head_second_factor(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;

revoke all on function private.head_factor_fresh() from public, anon;
grant execute on function private.head_factor_fresh() to authenticated;
