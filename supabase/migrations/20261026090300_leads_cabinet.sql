-- Раздел кабинета «Заявки» (шаг 3.7, мокап CabLeads) и «Новые заявки» на главной (Г1 B): чтение —
-- правами сотрудника (RLS leads), ведение — функциями с проверкой роли. Видеограф заявок не видит.

create function private.lead_row(l public.leads)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', l.id, 'number', l.number, 'created_at', l.created_at, 'type', l.type,
    'name', l.name, 'phone', l.phone, 'subject', l.subject, 'source', l.source, 'status', l.status,
    'assigned', (select jsonb_build_object('id', p.id, 'name', p.full_name) from public.profiles p where p.id = l.assigned_to),
    'repeat', l.repeat_of is not null,
    'deliveries', (select coalesce(jsonb_agg(jsonb_build_object('channel', d.channel, 'state', d.state) order by d.channel), '[]')
                   from public.lead_deliveries d where d.lead_id = l.id));
$$;

create function private.require_lead_staff()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Заявки ведут руководитель и менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
end;
$$;

-- Список с фильтрами мокапа: статус, тип, поиск по имени, телефону (от 3 цифр) и номеру «#1045».
create function public.leads_screen(p_status text, p_type text, p_query text, p_limit integer default 200)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  query text := btrim(coalesce(p_query, ''));
  digits text := regexp_replace(query, '[^0-9]', '', 'g');
begin
  perform private.require_lead_staff();
  return jsonb_build_object(
    'counts', (select jsonb_object_agg(s.status, (select count(*) from public.leads l where l.status = s.status))
               from unnest(enum_range(null::public.lead_status)) as s (status)),
    'total', (select count(*) from public.leads),
    'rows', (select coalesce(jsonb_agg(private.lead_row(x.lead) order by (x.lead).created_at desc), '[]')
      from (select l as lead from public.leads l
            where (p_status is null or l.status::text = p_status)
              and (p_type is null or l.type::text = p_type)
              and (query = ''
                   or l.name ilike '%' || query || '%'
                   or (length(digits) >= 3 and l.phone like '%' || digits || '%')
                   or (query ~ '^#?[0-9]+$' and l.number::text like ltrim(query, '#') || '%'))
            order by l.created_at desc
            limit least(greatest(coalesce(p_limit, 200), 1), 500)) as x));
end;
$$;

-- Карточка заявки: всё о ней, первая заявка при повторе, снимок расчёта, кому можно поручить.
create function public.lead_card(p_number bigint)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  card jsonb;
begin
  perform private.require_lead_staff();
  select to_jsonb(l) - 'client_key' || jsonb_build_object(
      'assigned', (select jsonb_build_object('id', p.id, 'name', p.full_name) from public.profiles p where p.id = l.assigned_to),
      'repeat_of', (select jsonb_build_object('number', r.number, 'created_at', r.created_at,
                     'assigned', (select p.full_name from public.profiles p where p.id = r.assigned_to))
                    from public.leads r where r.id = l.repeat_of),
      'deliveries', (select coalesce(jsonb_agg(to_jsonb(d) - 'lead_id' order by d.channel), '[]')
                     from public.lead_deliveries d where d.lead_id = l.id),
      'calculation', (select jsonb_build_object('input', c.input, 'result', c.result,
                       'program', c.program_snapshot - array['created_at', 'updated_at'], 'rate', c.rate)
                      from public.calculations c where c.lead_id = l.id order by c.created_at desc limit 1),
      'staff', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name, 'role', p.role) order by p.full_name), '[]')
                from public.profiles p where p.is_active and p.role in ('head', 'manager')))
    into card
    from public.leads l
    where l.number = p_number;
  if card is null then
    raise exception 'Заявка не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return card;
end;
$$;

-- Главная кабинета (Г1 B): новые, за сегодня по Ташкенту, в работе, встречи и шесть последних.
create function public.leads_home()
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
    'work', (select count(*) from public.leads l where l.status in ('work', 'called', 'meeting')),
    'meetings', (select count(*) from public.leads l where l.status = 'meeting'),
    'latest', (select coalesce(jsonb_agg(private.lead_row(x.lead) order by (x.lead).created_at desc), '[]')
               from (select l as lead from public.leads l order by l.created_at desc limit 6) as x));
end;
$$;

create function public.set_lead_status(p_lead uuid, p_status public.lead_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_lead_staff();
  update public.leads set status = p_status, updated_at = now(), updated_by = (select auth.uid())
    where id = p_lead;
  if not found then
    raise exception 'Заявка не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

-- Ответственный — активный руководитель или менеджер; новая заявка с ответственным — «В работе».
create function public.assign_lead(p_lead uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_lead_staff();
  if p_user is not null and not exists (
       select 1 from public.profiles p where p.id = p_user and p.is_active and p.role in ('head', 'manager')) then
    raise exception 'Сотрудник не ведёт заявки' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  update public.leads
    set assigned_to = p_user,
        status = case when p_user is not null and status = 'new' then 'work'::public.lead_status else status end,
        updated_at = now(), updated_by = (select auth.uid())
    where id = p_lead;
  if not found then
    raise exception 'Заявка не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

revoke all on function public.leads_screen(text, text, text, integer) from public, anon;
revoke all on function public.lead_card(bigint) from public, anon;
revoke all on function public.leads_home() from public, anon;
revoke all on function public.set_lead_status(uuid, public.lead_status) from public, anon;
revoke all on function public.assign_lead(uuid, uuid) from public, anon;
grant execute on function public.leads_screen(text, text, text, integer) to authenticated;
grant execute on function public.lead_card(bigint) to authenticated;
grant execute on function public.leads_home() to authenticated;
grant execute on function public.set_lead_status(uuid, public.lead_status) to authenticated;
grant execute on function public.assign_lead(uuid, uuid) to authenticated;
