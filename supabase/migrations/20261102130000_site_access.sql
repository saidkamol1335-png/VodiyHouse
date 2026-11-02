-- Проект-2, фаза B (PLAN §10, пп. 3–5): что видит и делает посетитель сайта (роль anon).
--   Чтение — только функции site_* (SECURITY DEFINER, уже вырезают черновики, неполное и скидки) и
--   два представления: public_settings (публичные настройки) и public_hints (включённые подсказки).
--   Таблицы anon напрямую не читает вовсе.
--   Запись — только три функции с подписью сервера сайта: заявка, «Написать в Telegram», события.
--   Секрета подписи у anon нет, поэтому прямой вызов из браузера с публичным ключом отклоняется.
-- service-ключа у сайта нет (фаза C): доставку заявок делает админка (Database Webhook).

-- ─── Чтение: таблицы закрыты, открыты два представления ──────────────────────────────────
revoke select on all tables in schema public from anon;
-- Новые таблицы миграций — тоже закрыты (Supabase по умолчанию открывает их anon целиком).
alter default privileges in schema public revoke all on tables from anon;

-- Владелец представления — владелец таблиц: RLS не участвует, фильтр — в самом представлении.
create view public.public_settings with (security_barrier) as
  select s.key, s.value from public.settings s where s.is_public;

create view public.public_hints with (security_barrier) as
  select h.slug, h.term, h.text from public.hints h where h.is_active;

revoke all on public.public_settings, public.public_hints from public, anon, authenticated;
grant select on public.public_settings, public.public_hints to anon, authenticated;

comment on view public.public_settings is 'Сайт: публичные настройки (контакты VH). Проект-2, фаза B.';
comment on view public.public_hints is 'Сайт: включённые подсказки калькулятора. Проект-2, фаза B.';

-- ─── Подпись сервера сайта ───────────────────────────────────────────────────────────────
-- Секрет — в Supabase Vault (имя site_signing_secret) и в env сайта SITE_SIGNING_SECRET; кладёт
-- исполнитель (PLAN §10, п. 14). Подпись: hex(HMAC-SHA256(secret, scope \n signed_at \n payload)),
-- payload — ровно та строка JSON, что ушла в вызов (база разбирает её сама, перестановка ключей
-- подпись не ломает и не обходит). signed_at — секунды Unix, окно ±5 минут.
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  -- pgcrypto в облаке уже стоит; если не в схеме extensions — подпись упала бы на первом вызове.
  if to_regprocedure('extensions.hmac(bytea, bytea, text)') is null
     or to_regprocedure('extensions.digest(text, text)') is null then
    raise exception 'pgcrypto не в схеме extensions — подпись сайта не заработает';
  end if;
end;
$$;

-- plpgsql, а не sql: тело не разбирается при создании, миграция не зависит от порядка установки
-- Vault. Нет Vault или секрета — подпись не настроена, записи сайта закрыты (vh:unavailable).
create function private.site_signing_secret()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'site_signing_secret' limit 1);
exception when undefined_table or invalid_schema_name then
  return null;
end;
$$;

-- Подпись — одноразовая: повтор того же запроса в окне ±5 минут отклоняется. Старше 10 минут —
-- удаляется на ходу (окно уже не пропустит).
create table private.site_request_nonces (
  signature text primary key,
  created_at timestamptz not null default now()
);
create index site_request_nonces_created_idx on private.site_request_nonces (created_at);
revoke all on private.site_request_nonces from public, anon, authenticated;

revoke all on function private.site_signing_secret() from public, anon, authenticated;

create function private.verify_site_signature(p_scope text, p_payload text, p_signed_at bigint, p_signature text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  secret text := private.site_signing_secret();
  expected text;
begin
  if secret is null or length(secret) < 32 then
    raise exception 'Подпись сайта не настроена' using errcode = 'insufficient_privilege', hint = 'vh:unavailable';
  end if;
  if p_payload is null or length(p_payload) > 32768 or p_signed_at is null
     or abs(extract(epoch from now()) - p_signed_at) > 300 then
    raise exception 'Запрос сайта устарел или пуст' using errcode = 'insufficient_privilege', hint = 'vh:bad_signature';
  end if;
  expected := encode(
    extensions.hmac(
      convert_to(p_scope || E'\n' || p_signed_at::text || E'\n' || p_payload, 'UTF8'),
      convert_to(secret, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
  -- Сравнение дайджестов, а не строк: время ответа не подсказывает, сколько символов совпало.
  if extensions.digest(coalesce(lower(p_signature), ''), 'sha256') is distinct from extensions.digest(expected, 'sha256') then
    raise exception 'Подпись сайта не сошлась' using errcode = 'insufficient_privilege', hint = 'vh:bad_signature';
  end if;
  delete from private.site_request_nonces n where n.created_at < now() - interval '10 minutes';
  insert into private.site_request_nonces (signature) values (expected) on conflict do nothing;
  if not found then
    raise exception 'Запрос сайта уже принят' using errcode = 'insufficient_privilege', hint = 'vh:bad_signature';
  end if;
  begin
    return p_payload::jsonb;
  exception when invalid_text_representation then
    raise exception 'Запрос сайта — не JSON' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end;
end;
$$;

revoke all on function private.verify_site_signature(text, text, bigint, text) from public, anon, authenticated;

-- Каналы доставки заявок задаёт админка (настройка leads.channels — массив telegram / sheet):
-- у сайта больше нет env Telegram и Таблицы. Нет настройки — заявка сохраняется, доставки нет.
-- Незнакомое значение пропускается: опечатка в настройке не должна ронять все заявки сайта.
create function private.lead_channels()
returns public.lead_channel[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select array_agg(distinct c.value::public.lead_channel)
     from public.settings s, jsonb_array_elements_text(s.value) c
     where s.key = 'leads.channels' and jsonb_typeof(s.value) = 'array'
       and c.value = any (enum_range(null::public.lead_channel)::text[])),
    '{}'
  )
$$;

revoke all on function private.lead_channels() from public, anon, authenticated;

-- ─── Запись: три функции для anon ────────────────────────────────────────────────────────
-- payload заявки: {lead: {…как у submit_lead…}, client_key}.
create function public.site_submit_lead(p_payload text, p_signed_at bigint, p_signature text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := private.verify_site_signature('lead', p_payload, p_signed_at, p_signature);
begin
  if jsonb_typeof(body -> 'lead') is distinct from 'object' then
    raise exception 'Заявка заполнена неверно' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  return public.submit_lead(body -> 'lead', private.lead_channels(), nullif(body ->> 'client_key', ''));
end;
$$;

-- payload: {start: {…как у create_tg_start…}, client_key}.
create function public.site_create_tg_start(p_payload text, p_signed_at bigint, p_signature text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := private.verify_site_signature('tg-start', p_payload, p_signed_at, p_signature);
begin
  if jsonb_typeof(body -> 'start') is distinct from 'object' then
    raise exception 'Запрос заполнен неверно' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  return public.create_tg_start(body -> 'start', nullif(body ->> 'client_key', ''));
end;
$$;

-- payload: {visitor, session, client_key, device, lang, source, medium?, content?, events: […]}.
create function public.site_track_events(p_payload text, p_signed_at bigint, p_signature text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  body jsonb := private.verify_site_signature('events', p_payload, p_signed_at, p_signature);
  v_visitor uuid;
  v_session uuid;
begin
  begin
    v_visitor := (body ->> 'visitor')::uuid;
    v_session := (body ->> 'session')::uuid;
  exception when invalid_text_representation then
    raise exception 'События заполнены неверно' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end;
  return public.track_events(
    v_visitor, v_session, nullif(body ->> 'client_key', ''), body ->> 'device', body ->> 'lang',
    body ->> 'source', coalesce(body -> 'events', '[]'), body ->> 'medium', body ->> 'content'
  );
end;
$$;

revoke all on function public.site_submit_lead(text, bigint, text) from public, authenticated;
revoke all on function public.site_create_tg_start(text, bigint, text) from public, authenticated;
revoke all on function public.site_track_events(text, bigint, text) from public, authenticated;
grant execute on function public.site_submit_lead(text, bigint, text) to anon, service_role;
grant execute on function public.site_create_tg_start(text, bigint, text) to anon, service_role;
grant execute on function public.site_track_events(text, bigint, text) to anon, service_role;
