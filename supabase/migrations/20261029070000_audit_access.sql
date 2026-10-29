-- Аудит безопасности 29.10 (пункты 3–10 отчёта): лишнее чтение и вызовы по ролям. Бизнес-логика не
-- меняется — только права, плюс потерянная блокировка лимита событий. Проверка — tests/db/access-matrix.test.ts.

-- ─── 3–5. Посетитель читает контент сайта только через функции site_* ─────────────────────
-- Напрямую (публичный ключ + REST) он видел сырые complex_ids витрины (UUID черновиков), ручные
-- price_from и available планировок и непривязанные чертежи ЖК. Сайт берёт всё это через
-- SECURITY DEFINER-функции (site_showcase, site_complex, layout_availability, site_complex_picker),
-- которые работают правами владельца; кабинет — сессией сотрудника (authenticated).
-- Политики «сайт — …» были to anon, authenticated: без них то же видел бы и вошедший без роли
-- (отключённый, с флагом смены пароля, со старым токеном). Теперь напрямую читают только сотрудники.
revoke select on public.specials, public.collections, public.ads, public.layouts, public.media_assets from anon;

do $$
declare
  p record;
begin
  for p in
    select tablename, policyname from pg_policies
    where schemaname = 'public' and cmd = 'SELECT' and 'anon' = any (roles)
      and tablename in ('specials', 'collections', 'ads', 'layouts', 'media_assets')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_staff()))',
      p.tablename || ': читают сотрудники (сайт — через функции)', p.tablename);
  end loop;
end;
$$;

-- ─── 6. Профили: коллеги видят только имя, роль и активность ──────────────────────────────
-- Флаг смены пароля и время закрытия сессий — только о себе: функция own_profile (вход, /admin/parol).
revoke select on public.profiles from authenticated;
grant select (id, full_name, role, is_active) on public.profiles to authenticated;

create function public.own_profile()
returns table (id uuid, full_name text, role public.staff_role, is_active boolean, must_change_password boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role, p.is_active, p.must_change_password
  from public.profiles p
  where p.id = (select auth.uid())
$$;

comment on function public.own_profile() is
  'Свой профиль сотрудника, вместе с флагом смены пароля (lib/admin/session.ts readOwnProfile).';

revoke all on function public.own_profile() from public, anon;
grant execute on function public.own_profile() to authenticated;

-- ─── 7. Хэш адреса посетителя в заявке живёт час ──────────────────────────────────────────
-- client_key нужен только лимиту частоты (окно 10 минут), а сотрудники читали его через REST и могли
-- связывать заявки одного посетителя. Столбец не прячется правами (функции заявок читают строку
-- целиком), поэтому он обнуляется: каждая новая заявка стирает ключи заявок старше часа.
create or replace function private.check_lead_rate(p_phone text, p_client_key text)
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('lead-rate-phone:' || coalesce(p_phone, ''), 0));
  if p_client_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('lead-rate-client:' || p_client_key, 0));
  end if;
  if (p_client_key is not null and (
        select count(*) from public.leads l
        where l.client_key = p_client_key and l.created_at > now() - interval '10 minutes') >= 5)
     or (select count(*) from public.leads l
         where l.phone = p_phone and l.created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Слишком много заявок подряд' using errcode = 'P0001', hint = 'vh:rate_limited';
  end if;
  update public.leads l set client_key = null
  where l.client_key is not null and l.created_at < now() - interval '1 hour';
end;
$$;

update public.leads set client_key = null where client_key is not null and created_at < now() - interval '1 hour';

-- ─── 8. Банки: выключенные видят руководитель и менеджер (PLAN §5: видеографу — нет) ──────
drop policy "banks: читают все, скрытое — сотрудники" on public.banks;
create policy "banks: читают все, скрытое — руководитель и менеджер" on public.banks for select to anon, authenticated
  using (is_active or (select private.has_role('head', 'manager')));

-- ─── 9. Лимит событий: блокировка ключа адреса вернулась ──────────────────────────────────
-- 20261028180000_site_showcase.sql переписал track_events без private.lock_event_key
-- (20261026170000_events_limits.sql): параллельные пачки с одного адреса читали один счётчик.
-- Тело — как в site_showcase, плюс замок перед проверкой лимита.
create or replace function public.track_events(
  p_visitor uuid, p_session uuid, p_client_key text, p_device text, p_lang text, p_source text, p_events jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hour timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_visitor is null or p_session is null or jsonb_typeof(p_events) is distinct from 'array' then
    return 0;
  end if;
  if p_client_key is not null then
    perform private.lock_event_key(p_client_key);
    if coalesce((select r.count from public.event_rates r where r.client_key = p_client_key and r.hour = v_hour), 0) >= 3000 then
      return 0;
    end if;
  end if;
  if (select count(*) from public.events e where e.visitor_id = p_visitor and e.at > now() - interval '1 hour') >= 600 then
    return 0;
  end if;
  insert into public.events (visitor_id, session_id, type, path, entity_type, entity_id, detail, source, device, lang)
  select p_visitor, p_session, x ->> 'type', left(x ->> 'path', 300),
         case when private.uuid_or_null(x ->> 'entity_id') is not null then x ->> 'entity_type' end,
         case when x ->> 'entity_type' in ('complex', 'layout', 'developer', 'ad') then private.uuid_or_null(x ->> 'entity_id') end,
         private.event_detail(x ->> 'type', btrim(x ->> 'detail')),
         -- Источник — метка utm или домен, не фраза: другое в ленту кабинета не идёт.
         case when btrim(p_source) ~ '^[A-Za-z0-9._-]{1,60}$' then btrim(p_source) end, p_device, p_lang
  from (select value as x from jsonb_array_elements(p_events) limit 20) as batch
  where jsonb_typeof(x) = 'object'
    and x ->> 'type' in (
      'page_view', 'complex_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter', 'lead_sent',
      'ad_view', 'ad_click');
  get diagnostics v_count = row_count;
  if p_client_key is not null and v_count > 0 then
    insert into public.event_rates (client_key, hour, count) values (p_client_key, v_hour, v_count)
    on conflict (client_key, hour) do update set count = public.event_rates.count + excluded.count;
  end if;
  return v_count;
exception
  when check_violation or invalid_text_representation then
    return 0;
end;
$$;

-- ─── 10. Функции: никаких прав по умолчанию ───────────────────────────────────────────────
-- Postgres даёт EXECUTE новым функциям всем (PUBLIC), Supabase в public — ещё и anon/authenticated.
-- Каждая миграция отзывала это руками, а у части функций private EXECUTE так и остался у всех (схема
-- private не открыта в Data API — это был единственный барьер). Теперь новые функции закрыты, пока
-- миграция не выдаст право явно.
-- PUBLIC — только глобально: встроенное право Postgres по схеме не отзывается (docs ALTER DEFAULT PRIVILEGES).
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated;

-- Служебные функции заявок: посетителю — ничего; лимит и снимок расчёта зовёт только submit_lead.
revoke execute on function
  private.check_lead_rate(text, text),
  private.save_lead_calculation(uuid, jsonb, jsonb)
from public, anon, authenticated;
grant execute on function
  private.check_lead_rate(text, text),
  private.save_lead_calculation(uuid, jsonb, jsonb)
to service_role;

revoke execute on function
  private.lead_message(uuid),
  private.lead_retry_delay(integer),
  private.lead_row(public.leads),
  private.lead_subject(jsonb),
  private.require_lead_staff()
from public, anon;
grant execute on function
  private.lead_message(uuid),
  private.lead_retry_delay(integer),
  private.lead_row(public.leads),
  private.lead_subject(jsonb),
  private.require_lead_staff()
to authenticated, service_role;
