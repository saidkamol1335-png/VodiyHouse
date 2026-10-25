-- Второй круг ревью блока F (шаг 3.12): подпись заявки в ленте — только тип заявки из lead_type
-- (раньше проходило любое слово латиницей), лимит с адреса — под блокировкой ключа: параллельные
-- пачки с одного адреса не проскакивают 3000 в час (как лимит заявок, блок D).

create or replace function private.event_detail(p_type text, p_detail text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type = 'share' and p_detail in ('telegram', 'copy') then p_detail
    when p_type = 'lead_sent' and p_detail = any (enum_range(null::public.lead_type)::text[]) then p_detail
    when p_type = 'favorite' and p_detail ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(p_detail) <= 120 then p_detail
  end;
$$;

-- Ключ адреса — под блокировкой до конца вызова: проверка и счётчик — одна очередь на адрес.
create or replace function private.lock_event_key(p_client_key text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtext('events:' || p_client_key));
$$;

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
         case when x ->> 'entity_type' in ('complex', 'layout', 'developer') then private.uuid_or_null(x ->> 'entity_id') end,
         private.event_detail(x ->> 'type', btrim(x ->> 'detail')),
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

revoke all on function private.lock_event_key(text) from public, anon, authenticated;
