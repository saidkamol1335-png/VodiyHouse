-- Заявки после ревью блока D (шаг 3.7–3.8). Применённые миграции не трогаем, правим здесь:
-- 1) очередь доставки «забирает» каналы: сервер сразу после заявки, «Повторить» и cron не шлют
--    одну заявку дважды (аренда 2 минуты; не записался итог — cron повторит после аренды);
-- 2) лимит частоты не обходится параллельными запросами (блокировка по номеру и адресу);
-- 3) неоткрытые коды бота живут столько же, сколько их принимает /start (7 дней);
-- 4) одно обновление Telegram обрабатывается один раз (повтор вебхука — не вторая заявка);
-- 5) расчёт «по планировке» на /kalkulyator находит ЖК; повтор без ЖК — только та же форма;
-- 6) «В работе» на главной кабинета считает то же, что открывает (статус «В работе»).

-- 1. Захват очереди -------------------------------------------------------------------------------

-- Аренда: пока сервер отправляет, канал «не к сроку»; итог попытки (record_lead_delivery) ставит
-- следующий срок сам. Аренда дольше любой отправки (тайм-аут канала — секунды).
create function private.claim_lead_channels(p_lead uuid)
returns jsonb
language sql
set search_path = ''
as $$
  with claimed as (
    update public.lead_deliveries d set next_at = now() + interval '2 minutes'
      where d.lead_id = p_lead and d.state = 'pending' and d.next_at <= now()
      returning d.channel
  )
  select coalesce(jsonb_agg(c.channel order by c.channel), '[]') from claimed c;
$$;

-- Сообщение заявки с теми каналами, которые забрал этот вызов (не все ждущие).
create function private.claimed_lead_message(p_lead uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_channels jsonb := private.claim_lead_channels(p_lead);
begin
  if jsonb_array_length(v_channels) = 0 then
    return null;
  end if;
  return private.lead_message(p_lead) || jsonb_build_object('channels', v_channels);
end;
$$;

-- Одна заявка — сразу после создания или «Повторить»: только каналы, которым пора; нечего — null.
create or replace function public.lead_for_delivery(p_lead uuid)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  select private.claimed_lead_message(p_lead);
$$;

-- Очередь cron: заявки, которым пора, забираются под блокировкой (два запуска не возьмут одну).
create or replace function public.lead_deliveries_due(p_limit integer default 20)
returns jsonb
language sql
volatile
security definer
set search_path = ''
as $$
  with due as (
    select d.lead_id, min(d.next_at) as next_at
    from public.lead_deliveries d
    where d.state = 'pending' and d.next_at <= now()
      and d.lead_id in (
        select x.lead_id from public.lead_deliveries x
        where x.state = 'pending' and x.next_at <= now()
        for update skip locked)
    group by d.lead_id
    order by min(d.next_at)
    limit least(greatest(p_limit, 1), 100)
  ),
  messages as (
    select private.claimed_lead_message(due.lead_id) as message, due.next_at from due
  )
  select coalesce(jsonb_agg(m.message order by m.next_at) filter (where m.message is not null), '[]')
  from messages m;
$$;

-- 1б. Объект заявки и повтор -------------------------------------------------------------------

-- Что заявка знает об объекте: опубликованный ЖК по адресу (slug), планировка и квартира — только
-- из этого ЖК; застройщик — у ЖК или по своему адресу (страница застройщика, 1б). Названия — снимком.
create or replace function private.lead_subject(p_lead jsonb)
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
    where cx.status = 'published'
      and (cx.slug = p_lead ->> 'complex'
           -- Калькулятор «по планировке» (/kalkulyator): адреса ЖК нет — ЖК той планировки, если он
           -- у того же опубликованного застройщика.
           or (p_lead ->> 'complex' is null and dv.slug = p_lead ->> 'developer'
               and cx.id = (select b.complex_id from public.layouts ly
                            join public.blocks b on b.id = ly.block_id
                            where ly.id = private.uuid_or_null(p_lead ->> 'layout'))));
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

-- Повтор за 24 часа (ТЗ 10.2) — по тому же ЖК; две разные заявки без ЖК повтором не считаются.
-- Заявка с сайта или от бота. Только сервер (секретный ключ): форма уже прошла ловушку, номер —
-- +998XXXXXXXXX. p_channels — каналы, которые настроены на сервере (без токенов — пусто: заявка
-- сохраняется, доставки нет). Повтор того же номера по тому же ЖК за 24 часа — repeat_of.
create or replace function public.submit_lead(p_lead jsonb, p_channels public.lead_channel[], p_client_key text)
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
      -- Тот же ЖК; без ЖК (подбор, расчёт по застройщику) — та же форма: разные запросы не повтор.
      and (l.complex_id = (v_subject ->> 'complex_id')::uuid
           or (l.complex_id is null and v_subject ->> 'complex_id' is null and l.type::text = p_lead ->> 'type'))
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

-- Главная кабинета: «В работе» — статус «В работе», как в списке по ссылке карточки (встречи —
-- отдельной строкой под цифрой).
create or replace function public.leads_home()
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
begin
  perform private.require_lead_staff();
  return jsonb_build_object(
    'new', (select count(*) from public.leads l where l.status = 'new'),
    'today', (select count(*) from public.leads l
              where (l.created_at at time zone 'Asia/Tashkent')::date = (now() at time zone 'Asia/Tashkent')::date),
    'work', (select count(*) from public.leads l where l.status = 'work'),
    'meetings', (select count(*) from public.leads l where l.status = 'meeting'),
    'latest', (select coalesce(jsonb_agg(private.lead_row(x.lead) order by (x.lead).created_at desc), '[]')
               from (select l as lead from public.leads l order by l.created_at desc limit 6) as x));
end;
$$;

-- 2. Лимит частоты --------------------------------------------------------------------------------

-- Блокировка до конца транзакции заявки: параллельные заявки с того же номера или адреса ждут
-- друг друга и видят уже сохранённые — count() не обойти одновременной отправкой.
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
end;
$$;

-- 3–4. Бот ------------------------------------------------------------------------------------------

create table public.tg_updates (
  update_id bigint primary key,
  created_at timestamptz not null default now()
);

alter table public.tg_updates enable row level security;
revoke all on public.tg_updates from anon, authenticated, service_role;

-- true — обновление новое, его надо обработать; false — Telegram прислал его повторно.
create function public.take_tg_update(p_update bigint)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tg_updates (update_id) values (p_update) on conflict do nothing;
  return found;
end;
$$;

-- Очистка (/api/cron): неоткрытые коды — через 7 дней (столько их принимает bind_tg_start),
-- остальные — через 30; отметки обновлений — через 2 дня (Telegram повторяет не дольше суток).
create or replace function public.cleanup_tg_starts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  delete from public.tg_updates u where u.created_at < now() - interval '2 days';
  with gone as (
    delete from public.tg_starts s
    where (s.started_at is null and s.created_at < now() - interval '7 days')
       or s.created_at < now() - interval '30 days'
    returning 1
  )
  select count(*)::integer into v_count from gone;
  return v_count;
end;
$$;

revoke all on function private.claim_lead_channels(uuid) from public, anon, authenticated;
revoke all on function private.claimed_lead_message(uuid) from public, anon, authenticated;
revoke all on function public.take_tg_update(bigint) from public, anon, authenticated;
grant execute on function public.take_tg_update(bigint) to service_role;

comment on table public.tg_updates is 'Обработанные обновления бота (update_id): повтор вебхука не создаёт вторую заявку. Только сервер.';
