-- Доставка заявок (шаг 3.7, ТЗ 10.4): сервер отправляет сразу после заявки, повторы — /api/cron по
-- next_at; до 10 попыток за сутки (паузы ниже — ~20 ч), потом «не доставлено». Не дошла ни в один
-- канал за 10 минут — тревога руководителю (один раз). Всё — только сервер (секретный ключ).

-- Пауза перед попыткой N+1 после N-й неудачной, минуты: 1, 5, 15, 30 мин, 1, 2, 3, 5, 8 ч.
create function private.lead_retry_delay(p_attempts integer)
returns interval
language sql
immutable
set search_path = ''
as $$
  select make_interval(mins => (array[1, 5, 15, 30, 60, 120, 180, 300, 480])[least(greatest(p_attempts, 1), 9)]);
$$;

-- Всё, что нужно сообщению и строке таблицы: заявка, номер первой (при повторе), снимок расчёта.
create function private.lead_message(p_lead uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(l) - 'client_key'
    || jsonb_build_object(
      'repeat_number', (select r.number from public.leads r where r.id = l.repeat_of),
      'channels', (select coalesce(jsonb_agg(d.channel order by d.channel), '[]')
                   from public.lead_deliveries d where d.lead_id = l.id and d.state = 'pending'))
  from public.leads l
  where l.id = p_lead;
$$;

-- Заявки, которым пора отправиться (своё время базы, не часы сервера).
create function public.lead_deliveries_due(p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(private.lead_message(x.lead_id)), '[]')
  from (
    select distinct d.lead_id, min(d.next_at) over (partition by d.lead_id) as due
    from public.lead_deliveries d
    where d.state = 'pending' and d.next_at <= now()
    order by due
    limit least(greatest(p_limit, 1), 100)
  ) as x;
$$;

-- Одна заявка — сразу после создания или «Повторить» в кабинете (только её ждущие каналы).
create function public.lead_for_delivery(p_lead uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.lead_message(p_lead);
$$;

-- Итог попытки по каналу: отправлено, повтор позже или «не доставлено» после 10-й.
create function public.record_lead_delivery(p_lead uuid, p_channel public.lead_channel, p_ok boolean, p_error text)
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
        next_at = now() + private.lead_retry_delay(d.attempts + 1)
    where d.lead_id = p_lead and d.channel = p_channel and d.state = 'pending';
$$;

-- Тревога «не дошла за 10 минут» (ТЗ 10.4): есть каналы, ни один не отправлен, тревоги ещё не было.
-- Отмечает сразу: сбой отправки тревоги не повторит её каждые 5 минут.
create function public.take_undelivered_leads(p_minutes integer default 10)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with due as (
    update public.leads l set alerted_at = now()
      where l.alerted_at is null and l.created_at < now() - make_interval(mins => p_minutes)
        and l.created_at > now() - interval '7 days'
        and exists (select 1 from public.lead_deliveries d where d.lead_id = l.id)
        and not exists (select 1 from public.lead_deliveries d where d.lead_id = l.id and d.state = 'sent')
      returning l.id, l.number, l.type, l.created_at
  )
  select coalesce(jsonb_agg(to_jsonb(due) order by due.number), '[]') from due;
$$;

revoke all on function public.lead_deliveries_due(integer) from public, anon, authenticated;
revoke all on function public.lead_for_delivery(uuid) from public, anon, authenticated;
revoke all on function public.record_lead_delivery(uuid, public.lead_channel, boolean, text) from public, anon, authenticated;
revoke all on function public.take_undelivered_leads(integer) from public, anon, authenticated;
grant execute on function public.lead_deliveries_due(integer) to service_role;
grant execute on function public.lead_for_delivery(uuid) to service_role;
grant execute on function public.record_lead_delivery(uuid, public.lead_channel, boolean, text) to service_role;
grant execute on function public.take_undelivered_leads(integer) to service_role;

-- «Повторить» в карточке заявки (мокап CabLeads): канал снова в очереди с нуля попыток.
create function public.retry_lead_delivery(p_lead uuid, p_channel public.lead_channel)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Заявки ведут руководитель и менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  update public.lead_deliveries d set state = 'pending', attempts = 0, next_at = now()
    where d.lead_id = p_lead and d.channel = p_channel and d.state <> 'sent';
  if not found then
    raise exception 'Канал уже доставлен или его нет' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

revoke all on function public.retry_lead_delivery(uuid, public.lead_channel) from public, anon;
grant execute on function public.retry_lead_delivery(uuid, public.lead_channel) to authenticated;
