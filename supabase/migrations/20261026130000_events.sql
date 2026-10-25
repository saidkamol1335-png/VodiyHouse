-- Свои события сайта (шаг 3.12, PLAN §6 events, ТЗ 16): что делают посетители — для «Сейчас на
-- сайте» на главной кабинета (мокап CabHome) и статистики. Без IP и без данных человека: посетитель —
-- случайный id в cookie на год, сессия — 30 минут. Боты и сотрудники (с сессией кабинета) не
-- записываются — это решает сервер сайта (/api/e) до вызова. Пишет только сервер (секретный ключ),
-- читают руководитель и менеджер — функцией site_now(). Хранятся 400 дней (очистка — /api/cron).

create table public.events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  visitor_id uuid not null,
  session_id uuid not null,
  type text not null check (type in (
    'page_view', 'complex_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter', 'lead_sent'
  )),
  path text check (length(path) <= 300),
  entity_type text check (entity_type in ('complex', 'layout', 'developer')),
  entity_id uuid,
  -- Что именно (подпись ленты): фильтр каталога текстом, канал «Поделиться», тип заявки.
  detail text check (length(detail) <= 120),
  -- Источник первого захода посетителя: utm_source или домен, откуда пришли; без меток — null.
  source text check (length(source) <= 60),
  device text not null check (device in ('mobile', 'tablet', 'desktop')),
  lang text not null check (lang in ('ru', 'uz'))
);

create index events_at_idx on public.events (at desc);
create index events_visitor_idx on public.events (visitor_id, at desc);

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated, service_role;

-- Пачка событий одного посетителя (сайт копит их и шлёт раз в несколько секунд). Не больше 20 за
-- вызов и 600 в час с посетителя: скрипт не забьёт таблицу. Чужое и битое молча пропускается.
create function public.track_events(p_visitor uuid, p_session uuid, p_device text, p_lang text, p_source text, p_events jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_visitor is null or p_session is null or jsonb_typeof(p_events) is distinct from 'array' then
    return 0;
  end if;
  if (select count(*) from public.events e where e.visitor_id = p_visitor and e.at > now() - interval '1 hour') >= 600 then
    return 0;
  end if;
  insert into public.events (visitor_id, session_id, type, path, entity_type, entity_id, detail, source, device, lang)
  select p_visitor, p_session, x ->> 'type', left(x ->> 'path', 300),
         case when private.uuid_or_null(x ->> 'entity_id') is not null then x ->> 'entity_type' end,
         case when x ->> 'entity_type' in ('complex', 'layout', 'developer') then private.uuid_or_null(x ->> 'entity_id') end,
         nullif(left(btrim(x ->> 'detail'), 120), ''), nullif(left(btrim(p_source), 60), ''), p_device, p_lang
  from (select value as x from jsonb_array_elements(p_events) limit 20) as batch
  where jsonb_typeof(x) = 'object'
    and x ->> 'type' in ('page_view', 'complex_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter', 'lead_sent');
  get diagnostics v_count = row_count;
  return v_count;
exception
  when check_violation or invalid_text_representation then
    return 0;
end;
$$;

-- «Сейчас на сайте» (мокап CabHome): посетителей за 5 минут и восемь последних действий (кроме
-- просмотров страниц — их слишком много для ленты) с названием ЖК на языке кабинета.
create function public.site_now()
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
        'at', e.at, 'type', e.type, 'detail', e.detail, 'source', e.source, 'device', e.device,
        'complex', (select c.name from public.complexes c where c.id = e.entity_id and e.entity_type = 'complex')
      ) as item
      from public.events e
      where e.type <> 'page_view' and e.at > now() - interval '24 hours'
      order by e.at desc
      limit 8
    ) as last));
end;
$$;

-- Очистка (/api/cron): события старше 400 дней — год с запасом на сравнение «год к году».
create function public.cleanup_events()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (delete from public.events e where e.at < now() - interval '400 days' returning 1)
  select count(*)::integer from gone;
$$;

revoke all on function public.track_events(uuid, uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.site_now() from public, anon;
revoke all on function public.cleanup_events() from public, anon, authenticated;
grant execute on function public.track_events(uuid, uuid, text, text, text, jsonb) to service_role;
grant execute on function public.site_now() to authenticated;
grant execute on function public.cleanup_events() to service_role;

comment on table public.events is 'События сайта (3.12): без IP и данных человека; пишет сервер (/api/e), читает site_now().';
