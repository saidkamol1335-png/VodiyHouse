-- Заявки (шаг 3.7): создание сервером, очередь доставки, тревога «не дошла за 10 минут», экран
-- кабинета «Заявки» и ведение (статус, ответственный). Отказы — hint 'vh:…' (lib/admin/authErrors.ts).

-- Строка → uuid без исключения: чужой ввод формы не роняет функцию на касте.
create function private.uuid_or_null(p_value text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then p_value::uuid end;
$$;

-- Что заявка знает об объекте: опубликованный ЖК по адресу (slug), планировка и квартира — только
-- из этого ЖК; застройщик — у ЖК или по своему адресу (страница застройщика, 1б). Названия — снимком.
create function private.lead_subject(p_lead jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  c record;
  l record;
  u record;
  d record;
begin
  select cx.id, cx.slug, cx.name, cx.developer_id into c
    from public.complexes cx
    join public.developers dv on dv.id = cx.developer_id and dv.status = 'published'
    where cx.slug = p_lead ->> 'complex' and cx.status = 'published';
  -- Без ЖК условия ниже не найдут строк — переменные всё равно получают значения (null).
  select ly.id, ly.rooms, ly.area, b.id as block_id, b.name as block_name into l
    from public.layouts ly
    join public.blocks b on b.id = ly.block_id
    where ly.id = private.uuid_or_null(p_lead ->> 'layout') and b.complex_id = c.id;
  select un.id, un.number into u
    from public.units un
    where un.id = private.uuid_or_null(p_lead ->> 'unit') and un.layout_id = l.id;
  select dv.id, dv.name into d
    from public.developers dv
    where dv.status = 'published'
      and (dv.id = c.developer_id or (c.id is null and dv.slug = p_lead ->> 'developer'));
  return jsonb_strip_nulls(jsonb_build_object(
    'complex_id', c.id, 'slug', c.slug, 'complex', c.name,
    'developer_id', d.id, 'developer', d.name,
    'block_id', l.block_id, 'block', l.block_name,
    'layout_id', l.id, 'layout', case when l.id is not null
      then jsonb_build_object('rooms', l.rooms, 'area', l.area) end,
    'unit_id', u.id, 'unit', u.number));
end;
$$;

-- Лимит частоты (ТЗ 10.2): с одного адреса — 5 заявок за 10 минут, с одного номера — 3.
create function private.check_lead_rate(p_phone text, p_client_key text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if (p_client_key is not null and (
        select count(*) from public.leads l
        where l.client_key = p_client_key and l.created_at > now() - interval '10 minutes') >= 5)
     or (select count(*) from public.leads l
         where l.phone = p_phone and l.created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Слишком много заявок подряд' using errcode = 'P0001', hint = 'vh:rate_limited';
  end if;
end;
$$;

-- Снимок расчёта с заявкой: программа — включённая у опубликованного застройщика (того же, что у ЖК);
-- условия и курс база берёт сама, как save_calculation.
create function private.save_lead_calculation(p_lead uuid, p_calc jsonb, p_subject jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  snapshot jsonb;
  program_id uuid := private.uuid_or_null(p_calc ->> 'program');
begin
  if jsonb_typeof(p_calc -> 'input') is distinct from 'object'
     or jsonb_typeof(p_calc -> 'result') is distinct from 'object'
     or length((p_calc -> 'input')::text) > 10000 or length((p_calc -> 'result')::text) > 20000 then
    return;
  end if;
  select to_jsonb(p) || jsonb_build_object('bank', b.name) into snapshot
    from public.payment_programs p
    join public.developers d on d.id = p.developer_id and d.status = 'published'
    left join public.banks b on b.id = p.bank_id
    where p.id = program_id and p.is_active
      and (p_subject ->> 'developer_id' is null or p.developer_id = (p_subject ->> 'developer_id')::uuid);
  if snapshot is null then
    return;
  end if;
  insert into public.calculations (channel, program_id, unit_id, lead_id, input, result, program_snapshot, rate)
  values ('site', program_id, (p_subject ->> 'unit_id')::uuid, p_lead, p_calc -> 'input', p_calc -> 'result',
          snapshot, private.exchange_rate());
end;
$$;

-- Заявка с сайта или от бота. Только сервер (секретный ключ): форма уже прошла ловушку, номер —
-- +998XXXXXXXXX. p_channels — каналы, которые настроены на сервере (без токенов — пусто: заявка
-- сохраняется, доставки нет). Повтор того же номера по тому же ЖК за 24 часа — repeat_of.
create function public.submit_lead(p_lead jsonb, p_channels public.lead_channel[], p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject jsonb;
  v_lead public.leads%rowtype;
  v_previous record;
begin
  if jsonb_typeof(p_lead) is distinct from 'object'
     or not (p_lead ->> 'type' = any (enum_range(null::public.lead_type)::text[])) then
    raise exception 'Заявка не распознана' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.check_lead_rate(p_lead ->> 'phone', p_client_key);
  v_subject := private.lead_subject(p_lead);
  select l.id, l.number into v_previous
    from public.leads l
    where l.phone = p_lead ->> 'phone' and l.created_at > now() - interval '24 hours'
      and l.complex_id is not distinct from (v_subject ->> 'complex_id')::uuid
    order by l.created_at
    limit 1;
  insert into public.leads (type, name, phone, contact_lang, site_lang, developer_id, complex_id, block_id,
                            layout_id, unit_id, subject, page_url, source, payload, repeat_of, client_key)
  values ((p_lead ->> 'type')::public.lead_type, btrim(p_lead ->> 'name'), p_lead ->> 'phone',
          p_lead ->> 'contact_lang', p_lead ->> 'site_lang',
          (v_subject ->> 'developer_id')::uuid, (v_subject ->> 'complex_id')::uuid, (v_subject ->> 'block_id')::uuid,
          (v_subject ->> 'layout_id')::uuid, (v_subject ->> 'unit_id')::uuid,
          v_subject - array['complex_id', 'developer_id', 'block_id', 'layout_id', 'unit_id'],
          p_lead ->> 'page_url', coalesce(p_lead -> 'source', '{}'), coalesce(p_lead -> 'payload', '{}'),
          v_previous.id, p_client_key)
  returning * into v_lead;
  if jsonb_typeof(p_lead -> 'calc') = 'object' then
    perform private.save_lead_calculation(v_lead.id, p_lead -> 'calc', v_subject);
  end if;
  insert into public.lead_deliveries (lead_id, channel)
    select v_lead.id, channel from unnest(coalesce(p_channels, '{}')) as x (channel) group by channel;
  return jsonb_build_object('id', v_lead.id, 'number', v_lead.number, 'repeat_of', v_previous.number);
exception
  when check_violation or not_null_violation or invalid_text_representation then
    raise exception 'Заявка не прошла проверку' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
end;
$$;

comment on function public.submit_lead(jsonb, public.lead_channel[], text) is
  'Заявка с сайта (ТЗ 10): только сервер. Лимит частоты, снимок названий, повтор за 24 ч, снимок расчёта, очередь доставки.';

revoke all on function public.submit_lead(jsonb, public.lead_channel[], text) from public, anon, authenticated;
grant execute on function public.submit_lead(jsonb, public.lead_channel[], text) to service_role;
