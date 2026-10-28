-- Фаза 3 · шаг 3.16б: «Витрина» на сайте. Одна функция ролью посетителя — подборки, спецпредложения
-- и реклама, которые видно сейчас (включено, период по ташкентской дате, застройщик опубликован,
-- ЖК — только опубликованные); события показа и клика рекламы (ad_view / ad_click, PLAN §3а);
-- напоминание руководителю за 3 дня до конца спецпредложения или рекламы (ТЗ 8.5, /api/cron).

-- ─── Витрина для сайта ───────────────────────────────────────────────────────────────────

-- ЖК записи, которые видит посетитель, в порядке руководителя.
create function private.showcase_public_complexes(p_ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.id order by x.ord), '[]'::jsonb)
  from unnest(p_ids) with ordinality as x (id, ord)
  where private.is_public_complex(x.id)
$$;

revoke all on function private.showcase_public_complexes(uuid[]) from public;
grant execute on function private.showcase_public_complexes(uuid[]) to anon, authenticated, service_role;

create function public.site_showcase()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'today', private.tashkent_today(),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id, 'slug', k.slug, 'title', k.title, 'mode', k.mode, 'filter', k.filter,
          'complex_ids', private.showcase_public_complexes(k.complex_ids),
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.collection_id = k.id and m.kind = 'cover'))
        order by k.sort, k.created_at)
      from public.collections k
      where k.is_active), '[]'::jsonb),
    'specials', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'kind', s.kind, 'badge', s.badge, 'title', s.title, 'text', s.text,
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'complex_ids', private.showcase_public_complexes(s.complex_ids),
          'valid_to', s.valid_to,
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.special_id = s.id and m.kind = 'cover'))
        order by s.sort, s.created_at)
      from public.specials s
      join public.developers d on d.id = s.developer_id
      where private.showcase_visible(s.is_active, s.valid_from, s.valid_to, s.developer_id)), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'text', a.text, 'filter', a.filter,
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'complex_ids', private.showcase_public_complexes(a.complex_ids),
          'valid_to', a.valid_to,
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.ad_id = a.id and m.kind = 'cover'))
        order by a.sort, a.created_at)
      from public.ads a
      join public.developers d on d.id = a.developer_id
      where private.showcase_visible(a.is_active, a.valid_from, a.valid_to, a.developer_id)), '[]'::jsonb)
  )
$$;

comment on function public.site_showcase() is
  'Витрина сайта: действующие подборки, спецпредложения и реклама (по порядку руководителя) ролью посетителя.';

revoke all on function public.site_showcase() from public;
grant execute on function public.site_showcase() to anon, authenticated, service_role;

-- ─── Напоминание за 3 дня до конца (ТЗ 8.5) ─────────────────────────────────────────────
-- Одно напоминание на запись и дату конца: продлили — конец другой, напомним снова.
create table public.showcase_notices (
  kind text not null check (kind in ('special', 'ad')),
  entity_id uuid not null,
  valid_to date not null,
  reminded_at timestamptz not null default now(),
  primary key (kind, entity_id, valid_to)
);

alter table public.showcase_notices enable row level security;
revoke all on public.showcase_notices from anon, authenticated, service_role;

-- Что заканчивается в ближайшие 3 дня и о чём ещё не напоминали; отмечает сразу (сбой отправки не
-- повторит напоминание каждую ночь). Только серверу (/api/cron/showcase).
create function public.take_showcase_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.tashkent_today();
  v_items jsonb;
begin
  -- Отметки удалённых записей (и DEMO после demo:remove) — чтобы таблица не росла без дела.
  delete from public.showcase_notices n
  where (n.kind = 'special' and not exists (select 1 from public.specials s where s.id = n.entity_id))
     or (n.kind = 'ad' and not exists (select 1 from public.ads a where a.id = n.entity_id));
  with due as (
    select 'special'::text as kind, s.id, s.title, d.name as developer, s.valid_to
    from public.specials s
    join public.developers d on d.id = s.developer_id
    where s.is_active and s.valid_to between v_today and v_today + 3
      and not exists (select 1 from public.showcase_notices n
                      where n.kind = 'special' and n.entity_id = s.id and n.valid_to = s.valid_to)
    union all
    select 'ad', a.id, a.title, d.name, a.valid_to
    from public.ads a
    join public.developers d on d.id = a.developer_id
    where a.is_active and a.valid_to between v_today and v_today + 3
      and not exists (select 1 from public.showcase_notices n
                      where n.kind = 'ad' and n.entity_id = a.id and n.valid_to = a.valid_to)
  ),
  marked as (
    insert into public.showcase_notices (kind, entity_id, valid_to)
    select due.kind, due.id, due.valid_to from due
    returning entity_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', due.kind, 'id', due.id, 'title', due.title, 'developer', due.developer, 'valid_to', due.valid_to)
    order by due.valid_to, due.title ->> 'ru'), '[]'::jsonb)
    into v_items
  from due;
  return v_items;
end;
$$;

comment on function public.take_showcase_reminders() is
  'Спецпредложения и реклама, которые заканчиваются в ближайшие 3 дня (без повтора) — для напоминания руководителю.';

revoke all on function public.take_showcase_reminders() from public, anon, authenticated;
grant execute on function public.take_showcase_reminders() to service_role;

-- ─── События рекламы: ad_view и ad_click ─────────────────────────────────────────────────
-- Показ — карточка в кадре на главной, клик — «Показать квартиры» или ЖК карточки; объект — реклама.

do $$
declare
  old_check record;
begin
  for old_check in
    select conname
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%page_view%' or pg_get_constraintdef(oid) like '%''layout''%')
  loop
    execute format('alter table public.events drop constraint %I', old_check.conname);
  end loop;
end;
$$;

alter table public.events
  add constraint events_type_check check (type in (
    'page_view', 'complex_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter', 'lead_sent',
    'ad_view', 'ad_click'
  )),
  add constraint events_entity_type_check check (entity_type in ('complex', 'layout', 'developer', 'ad'));

-- Та же функция, что в миграции 20261026150000, плюс типы и объект рекламы.
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
  if p_client_key is not null
     and coalesce((select r.count from public.event_rates r where r.client_key = p_client_key and r.hour = v_hour), 0) >= 3000 then
    return 0;
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

-- Лента «Сейчас на сайте»: клик по рекламе — с её заголовком; показы рекламы в ленту не идут
-- (они на каждом открытии главной и вытеснили бы действия посетителей), только в статистику.
create or replace function public.site_now()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_lead_staff();
  return jsonb_build_object(
    'online', (select count(distinct e.visitor_id) from public.events e where e.at > now() - interval '5 minutes'),
    'feed', (select coalesce(jsonb_agg(item order by item ->> 'at' desc), '[]') from (
      select jsonb_build_object(
        'at', e.at, 'type', e.type, 'source', e.source, 'device', e.device,
        'detail', case when e.type in ('share', 'lead_sent') then e.detail end,
        'path', case when e.type = 'filter' then e.path end,
        'complex', coalesce(
          (select c.name from public.complexes c where c.id = e.entity_id and e.entity_type = 'complex'),
          (select c.name from public.complexes c where e.type = 'favorite' and e.entity_id is null and c.slug = e.detail)
        ),
        'ad', (select a.title from public.ads a where a.id = e.entity_id and e.entity_type = 'ad')
      ) as item
      from public.events e
      where e.type not in ('page_view', 'ad_view') and e.at > now() - interval '24 hours'
      order by e.at desc
      limit 8
    ) as last));
end;
$$;
