-- Заявки, второй круг ревью блока D. Применённые миграции не трогаем:
-- 1) аренда канала — отдельная колонка claimed_until, а не next_at: «Повторить» (next_at = now())
--    не снимает аренду отправки, которая уже идёт, — одна заявка не уходит в чат дважды;
-- 2) захват берёт только незанятые строки (for update skip locked): сервер после заявки и cron не
--    ждут друг друга и не ловят взаимную блокировку на заявке с двумя каналами;
-- 3) повтор без ЖК — та же форма у того же застройщика (две страницы застройщиков — не повтор).

alter table public.lead_deliveries add column claimed_until timestamptz;

-- Забрать каналы заявки, которым пора и которые никто не отправляет; занятые — пропустить.
create or replace function private.claim_lead_channels(p_lead uuid)
returns jsonb
language sql
set search_path = ''
as $$
  with free as (
    select d.lead_id, d.channel from public.lead_deliveries d
    where d.lead_id = p_lead and d.state = 'pending' and d.next_at <= now()
      and (d.claimed_until is null or d.claimed_until <= now())
    for update skip locked
  ),
  claimed as (
    update public.lead_deliveries d set claimed_until = now() + interval '2 minutes'
      from free
      where d.lead_id = free.lead_id and d.channel = free.channel
      returning d.channel
  )
  select coalesce(jsonb_agg(c.channel order by c.channel), '[]') from claimed c;
$$;

-- Очередь cron: заявки, у которых есть свободный канал к сроку; забирает их claim_lead_channels.
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
      and (d.claimed_until is null or d.claimed_until <= now())
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

-- Итог попытки снимает аренду: следующий срок — по паузе повтора.
create or replace function public.record_lead_delivery(p_lead uuid, p_channel public.lead_channel, p_ok boolean, p_error text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.lead_deliveries d
    set attempts = d.attempts + 1,
        state = case when p_ok then 'sent' when d.attempts + 1 >= 10 then 'failed' else 'pending' end::public.lead_delivery_state,
        sent_at = case when p_ok then now() end,
        last_error = case when p_ok then null else left(coalesce(p_error, 'нет ответа'), 300) end,
        next_at = now() + private.lead_retry_delay(d.attempts + 1),
        claimed_until = null
    where d.lead_id = p_lead and d.channel = p_channel and d.state = 'pending';
$$;

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
      -- Тот же ЖК; без ЖК (подбор, расчёт по застройщику) — та же форма у того же застройщика, и не
      -- заявка по ЖК, которого больше нет (снимок slug): разные запросы не повтор.
      and (l.complex_id = (v_subject ->> 'complex_id')::uuid
           or (l.complex_id is null and v_subject ->> 'complex_id' is null and l.type::text = p_lead ->> 'type'
               and l.developer_id is not distinct from (v_subject ->> 'developer_id')::uuid
               and l.subject ->> 'slug' is null))
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
