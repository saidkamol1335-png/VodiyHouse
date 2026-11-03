-- Фаза F, п. 41: блок «Ход стройки» в статистике руководителя за период — опубликовано и возвращено
-- отчётов, среднее ожидание проверки, ЖК без отчёта за месяц. История переходов есть только в
-- журнале (audit_log): в строке отчёта return_note и published_at — последние, удалённые отчёты
-- пропадают, возвратов бывает несколько. Черновики в журнал не пишутся (skip_audit), а функция —
-- security definer мимо RLS, поэтому к таблице отчётов — только с явным списком статусов.

-- История одного отчёта по журналу (начало ожидания перед решением).
create index if not exists audit_log_progress_idx
  on public.audit_log (entity_id, at)
  where entity = 'progress_reports';

create or replace function public.progress_stats(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := private.tashkent_today();
  v_from timestamptz;
  v_until timestamptz;
  v_month date;
  v_decisions jsonb;
  v_now jsonb;
  v_complexes jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Статистику видит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  -- Те же границы, что у site_stats: период из экрана статистики.
  if p_from is null or p_to is null or p_from > p_to or p_to > v_today or p_from < v_today - 400 then
    raise exception 'Период статистики: с % по %', p_from, p_to using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  v_from := p_from::timestamp at time zone 'Asia/Tashkent';
  v_until := least((p_to + 1)::timestamp at time zone 'Asia/Tashkent', now());
  v_month := date_trunc('month', p_to)::date;

  -- Переходы статуса: insert — сразу «На проверку» (черновик в журнал не попадает); update — пара
  -- [было, стало]. Ручная строка «Убрать кадр» (changes.photos) статуса не несёт и сюда не входит.
  with moves as (
    select a.id, a.at, a.entity_id,
      case when a.action = 'insert' then null else a.changes -> 'status' ->> 0 end as from_s,
      case when a.action = 'insert' then a.changes ->> 'status' else a.changes -> 'status' ->> 1 end as to_s
    from public.audit_log a
    where a.entity = 'progress_reports' and a.action in ('insert', 'update') and a.changes ? 'status'
  ),
  decided as (
    select m.* from moves m
    where m.at >= v_from and m.at < v_until and m.from_s = 'review' and m.to_s in ('published', 'returned')
  ),
  timed as (
    select d.*, q.at as queued_at, q.from_s as queued_from,
      -- Отчёт квартиры: по живой строке, удалённый — по последней записи журнала с is_unit.
      coalesce(
        (select r.is_unit from public.progress_reports r where r.id::text = d.entity_id),
        (select coalesce((a.changes ->> 'is_unit')::boolean, (a.changes -> 'is_unit' ->> 1)::boolean)
           from public.audit_log a
           where a.entity = 'progress_reports' and a.entity_id = d.entity_id and a.changes ? 'is_unit'
           order by a.at desc, a.id desc limit 1),
        false
      ) as is_unit
    from decided d
    left join lateral (
      select m.at, m.from_s from moves m
      where m.entity_id = d.entity_id and m.to_s = 'review' and (m.at, m.id) < (d.at, d.id)
      order by m.at desc, m.id desc limit 1
    ) q on true
  )
  select jsonb_build_object(
    'published', count(distinct t.entity_id) filter (where t.to_s = 'published' and not t.is_unit),
    'returned', count(*) filter (where t.to_s = 'returned' and not t.is_unit),
    'returned_reports', count(distinct t.entity_id) filter (where t.to_s = 'returned' and not t.is_unit),
    'unit_published', count(distinct t.entity_id) filter (where t.to_s = 'published' and t.is_unit),
    'unit_returned', count(*) filter (where t.to_s = 'returned' and t.is_unit),
    -- Ожидание — от последней отправки до решения, все отчёты (и блоков, и квартир); часы на часах,
    -- ночи и выходные входят. Снятый с публикации и опубликованный снова — не ожидание автора.
    'wait_count', count(*) filter (where t.queued_at is not null and t.queued_from is distinct from 'published'),
    'wait_avg_hours', round((avg(extract(epoch from t.at - t.queued_at) / 3600)
      filter (where t.queued_at is not null and t.queued_from is distinct from 'published'))::numeric, 1),
    'wait_max_hours', round((max(extract(epoch from t.at - t.queued_at) / 3600)
      filter (where t.queued_at is not null and t.queued_from is distinct from 'published'))::numeric, 1)
  ) into v_decisions
  from timed t;

  -- Ждут проверки сейчас: самое долгое ожидание — от последней отправки по журналу, не от created_at.
  select jsonb_build_object(
    'waiting_now', count(*),
    'oldest_wait_hours', round((max(extract(epoch from now() - q.at) / 3600))::numeric, 1)
  ) into v_now
  from public.progress_reports r
  left join lateral (
    select a.at from public.audit_log a
    where a.entity = 'progress_reports' and a.entity_id = r.id::text
      and (a.changes ->> 'status' = 'review' or a.changes -> 'status' ->> 1 = 'review')
    order by a.at desc, a.id desc limit 1
  ) q on true
  where r.status = 'review';

  -- ЖК без отчёта за месяц конца периода — как «Задания»: строящиеся блоки ЖК вне архива; блок закрыт
  -- отчётом на проверке или опубликованным. Возвращённый — «возвращён»; черновик не виден никому, кроме
  -- автора, — здесь он «нет отчёта».
  with blk as (
    select b.id, b.complex_id, b.name, b.sort,
      (select r.status::text from public.progress_reports r
        where r.block_id = b.id and not r.is_unit and r.month = v_month
          and r.status in ('review', 'published', 'returned')
        order by case r.status when 'published' then 0 when 'review' then 1 else 2 end limit 1) as state
    from public.blocks b
    join public.complexes c on c.id = b.complex_id
    where b.build_status = 'building' and c.status <> 'archived'
  ),
  per as (
    select c.id, c.name, c.status::text as status,
      count(*) as blocks_total,
      count(*) filter (where k.state in ('review', 'published')) as blocks_done,
      jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name, 'state', coalesce(k.state, 'none'))
        order by k.sort, k.name) filter (where k.state is null or k.state = 'returned') as missing,
      (select max(r.published_at) from public.progress_reports r
        where r.complex_id = c.id and not r.is_unit and r.status = 'published') as last_published_at
    from blk k join public.complexes c on c.id = k.complex_id
    group by c.id
  )
  select jsonb_build_object(
    'complexes_building', count(*),
    'complexes_without', coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'status', p.status,
        'blocks_total', p.blocks_total, 'blocks_done', p.blocks_done,
        'missing', p.missing, 'last_published_at', p.last_published_at,
        -- Как «45+ дн.» в «Проверке» и напоминание бота: последний опубликованный старше 45 дней.
        'late', p.last_published_at is null or p.last_published_at < now() - interval '45 days')
      order by p.last_published_at asc nulls first, p.name ->> 'ru')
      filter (where p.blocks_done < p.blocks_total), '[]'::jsonb)
  ) into v_complexes
  from per p;

  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'until', v_until,
    'month', v_month, 'month_open', v_month = date_trunc('month', v_today)::date
  ) || v_decisions || v_now || v_complexes;
end;
$$;

revoke all on function public.progress_stats(date, date) from public, anon;
grant execute on function public.progress_stats(date, date) to authenticated;
