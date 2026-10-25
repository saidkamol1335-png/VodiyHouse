-- Исправления ревью блока F (шаг 3.12, события сайта):
-- 1) лимит 600 в час «с посетителя» обходился без cookie (каждая пачка — новый посетитель): второй
--    лимит — с адреса, по солёному хэшу IP (тот же ключ, что у заявок; сам IP не храним), счётчик
--    по часам в event_rates, старые часы чистит cleanup_events;
-- 2) подпись ленты «Сейчас на сайте» была свободным текстом из браузера — любой мог вписать в
--    кабинет что угодно. Теперь подпись — только из известных значений: «Поделиться» — канал,
--    заявка — тип, избранное — адрес ЖК (название берёт база), фильтр — без текста: кабинет
--    читает его из адреса страницы (параметры каталога, которые сайт проверяет сам).

create table public.event_rates (
  client_key text not null check (length(client_key) <= 128),
  hour timestamptz not null,
  count integer not null default 0,
  primary key (client_key, hour)
);

alter table public.event_rates enable row level security;
revoke all on public.event_rates from anon, authenticated, service_role;

drop function public.track_events(uuid, uuid, text, text, text, jsonb);

-- Подпись события — только известное значение; остальное — null (в ленте — просто тип события).
create function private.event_detail(p_type text, p_detail text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'share' and p_detail in ('telegram', 'copy') then p_detail
    when p_type = 'lead_sent' and p_detail ~ '^[a-z_]{1,24}$' then p_detail
    when p_type = 'favorite' and p_detail ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(p_detail) <= 120 then p_detail
  end;
$$;

-- Пачка событий одного посетителя: ≤ 20 за вызов, ≤ 600 в час с посетителя и ≤ 3000 в час с
-- адреса (мобильные операторы выводят многих людей через один адрес — запас большой).
create function public.track_events(
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
         case when x ->> 'entity_type' in ('complex', 'layout', 'developer') then private.uuid_or_null(x ->> 'entity_id') end,
         private.event_detail(x ->> 'type', btrim(x ->> 'detail')),
         -- Источник — метка utm или домен, не фраза: другое в ленту кабинета не идёт.
         case when btrim(p_source) ~ '^[A-Za-z0-9._-]{1,60}$' then btrim(p_source) end, p_device, p_lang
  from (select value as x from jsonb_array_elements(p_events) limit 20) as batch
  where jsonb_typeof(x) = 'object'
    and x ->> 'type' in ('page_view', 'complex_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter', 'lead_sent');
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

-- Лента: у фильтра — адрес страницы (кабинет разбирает параметры каталога), у избранного —
-- название ЖК по его адресу; свободного текста из браузера в ленте нет.
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
        )
      ) as item
      from public.events e
      where e.type <> 'page_view' and e.at > now() - interval '24 hours'
      order by e.at desc
      limit 8
    ) as last));
end;
$$;

-- Очистка: события старше 400 дней и счётчики адресов старше суток.
create or replace function public.cleanup_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.event_rates r where r.hour < now() - interval '1 day';
  with gone as (delete from public.events e where e.at < now() - interval '400 days' returning 1)
  select count(*)::integer into v_count from gone;
  return v_count;
end;
$$;

revoke all on function private.event_detail(text, text) from public, anon, authenticated;
revoke all on function public.track_events(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.track_events(uuid, uuid, text, text, text, text, jsonb) to service_role;

comment on table public.event_rates is 'Счётчик событий по часам с адреса (3.12): солёный хэш IP, сам адрес не храним.';
