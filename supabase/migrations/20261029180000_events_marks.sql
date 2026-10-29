-- Фаза 6 (6A.1), статистика: у события — метки рекламы первого захода (utm_medium, utm_content —
-- панель «Рекламные креативы · UTM» мокапа CabStats) и новый тип layout_view — раздел «Планировки»
-- ЖК был на экране (шаг «Смотрели планировки» в «Пути посетителя»). Метки — слово латиницей, как
-- источник: фраза или телефон в базу не попадают. track_events — та же, что в 20261029070000, плюс
-- два аргумента со значением по умолчанию: сайт, выложенный до этой миграции, зовёт её без них.

alter table public.events
  add column medium text check (medium ~ '^[A-Za-z0-9._-]{1,60}$'),
  add column content text check (content ~ '^[A-Za-z0-9._-]{1,60}$');

alter table public.events drop constraint events_type_check;
alter table public.events
  add constraint events_type_check check (type in (
    'page_view', 'complex_view', 'layout_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter',
    'lead_sent', 'ad_view', 'ad_click'
  ));

drop function public.track_events(uuid, uuid, text, text, text, text, jsonb);

create function public.track_events(
  p_visitor uuid, p_session uuid, p_client_key text, p_device text, p_lang text, p_source text, p_events jsonb,
  p_medium text default null, p_content text default null
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
  insert into public.events (visitor_id, session_id, type, path, entity_type, entity_id, detail, source, medium, content, device, lang)
  select p_visitor, p_session, x ->> 'type', left(x ->> 'path', 300),
         case when private.uuid_or_null(x ->> 'entity_id') is not null then x ->> 'entity_type' end,
         case when x ->> 'entity_type' in ('complex', 'layout', 'developer', 'ad') then private.uuid_or_null(x ->> 'entity_id') end,
         private.event_detail(x ->> 'type', btrim(x ->> 'detail')),
         -- Источник и метки — слово utm или домен, не фраза: другое в ленту и статистику не идёт.
         case when btrim(p_source) ~ '^[A-Za-z0-9._-]{1,60}$' then btrim(p_source) end,
         case when btrim(p_medium) ~ '^[A-Za-z0-9._-]{1,60}$' then btrim(p_medium) end,
         case when btrim(p_content) ~ '^[A-Za-z0-9._-]{1,60}$' then btrim(p_content) end,
         p_device, p_lang
  from (select value as x from jsonb_array_elements(p_events) limit 20) as batch
  where jsonb_typeof(x) = 'object'
    and x ->> 'type' in (
      'page_view', 'complex_view', 'layout_view', 'phone_click', 'telegram_click', 'favorite', 'share', 'filter',
      'lead_sent', 'ad_view', 'ad_click');
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

revoke all on function public.track_events(uuid, uuid, text, text, text, text, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.track_events(uuid, uuid, text, text, text, text, jsonb, text, text) to service_role;

-- Лента «Сейчас на сайте» — как в 20261028180000, плюс layout_view не идёт в ленту: это не действие
-- посетителя, а прокрутка до раздела — только в статистику (как показы рекламы).
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
      where e.type not in ('page_view', 'ad_view', 'layout_view') and e.at > now() - interval '24 hours'
      order by e.at desc
      limit 8
    ) as last));
end;
$$;

comment on column public.events.medium is 'utm_medium первого захода посетителя (подпись креатива: Reels, Stories).';
comment on column public.events.content is 'utm_content первого захода посетителя — креатив рекламы (статистика, фаза 6).';
