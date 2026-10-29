-- Фаза 6, ревью блока 6A (второй агент): исправления site_stats (20261029190000). Функции — те же,
-- изменилось три вещи:
-- 1. Заявки статистики — private.stats_leads: без формы «Застройщикам» (partner — не покупатель, в
--    «Типах заявок» мокапа её нет; вопрос заказчику 2 в docs/progress/phase-6.md).
-- 2. Метка креатива заявки — как у события: пробелы → «_», только латиница, цифры, «._-», до 60
--    знаков (private.utm_mark; у события то же делает /api/e и track_events). Иначе «Shodlik reels 03»
--    из {{ad.name}} Meta у заявки и «Shodlik_reels_03» у посетителя — две строки креатива.
-- 3. «Прошлый период» есть, только если он целиком в сроке хранения событий (400 дней): у периода
--    в 300 дней прошлый наполовину стёрт — «рост» был бы ложным.

create function private.utm_mark(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when m ~ '^[A-Za-z0-9._-]{1,60}$' then m end
  from (select regexp_replace(btrim(p_value), '\s+', '_', 'g') as m) as x
$$;

create view private.stats_leads as
select l.id, l.created_at, l.type, l.complex_id, l.developer_id,
       private.utm_mark(l.source ->> 'utm_source') as source,
       private.utm_mark(l.source ->> 'utm_medium') as medium,
       private.utm_mark(l.source ->> 'utm_content') as content
from public.leads l
where l.type <> 'partner';

revoke all on private.stats_leads from public, anon, authenticated;
revoke all on function private.utm_mark(text) from public, anon, authenticated;

-- Итоги отрезка [p_from, p_to).
create or replace function private.stats_totals(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'visitors', count(distinct e.visitor_id),
    'visits', count(distinct e.session_id),
    'views', count(*) filter (where e.type = 'page_view'),
    'contacts', count(distinct e.visitor_id) filter (where e.type in ('phone_click', 'telegram_click')),
    'complex_visitors', count(distinct e.visitor_id) filter (where e.type = 'complex_view'),
    'layout_visitors', count(distinct e.visitor_id) filter (where e.type = 'layout_view'),
    'leads', (select count(*) from private.stats_leads l where l.created_at >= p_from and l.created_at < p_to)
  )
  from public.events e
  where e.at >= p_from and e.at < p_to
$$;

-- График: точки по часам (один день) или по дням; текущий отрезок обрезан «сейчас» (будущие часы —
-- null), прошлый — целиком, со сдвигом на длину периода.
create or replace function private.stats_series(p_from timestamptz, p_until timestamptz, p_count integer, p_step interval, p_shift interval)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with buckets as (
    select i, p_from + i * p_step as f
    from generate_series(0, p_count - 1) as i
  ),
  ev as (
    select date_bin(p_step, e.at, p_from) as f,
           count(distinct e.visitor_id) as visitors, count(distinct e.session_id) as visits,
           count(*) filter (where e.type = 'page_view') as views
    from public.events e
    where e.at >= p_from and e.at < p_until
    group by 1
  ),
  ev_prev as (
    select date_bin(p_step, e.at, p_from - p_shift) + p_shift as f,
           count(distinct e.visitor_id) as visitors, count(distinct e.session_id) as visits,
           count(*) filter (where e.type = 'page_view') as views
    from public.events e
    where e.at >= p_from - p_shift and e.at < p_from - p_shift + p_count * p_step
    group by 1
  ),
  ld as (
    select date_bin(p_step, l.created_at, p_from) as f, count(*) as leads
    from private.stats_leads l
    where l.created_at >= p_from and l.created_at < p_until
    group by 1
  ),
  ld_prev as (
    select date_bin(p_step, l.created_at, p_from - p_shift) + p_shift as f, count(*) as leads
    from private.stats_leads l
    where l.created_at >= p_from - p_shift and l.created_at < p_from - p_shift + p_count * p_step
    group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'day', (b.f at time zone 'Asia/Tashkent')::date,
    'hour', extract(hour from b.f at time zone 'Asia/Tashkent')::integer,
    'cur', case when b.f < p_until then jsonb_build_object(
      'visitors', coalesce(ev.visitors, 0), 'visits', coalesce(ev.visits, 0),
      'views', coalesce(ev.views, 0), 'leads', coalesce(ld.leads, 0)) end,
    'prev', jsonb_build_object(
      'visitors', coalesce(pv.visitors, 0), 'visits', coalesce(pv.visits, 0),
      'views', coalesce(pv.views, 0), 'leads', coalesce(pl.leads, 0))
  ) order by b.i), '[]')
  from buckets b
  left join ev on ev.f = b.f
  left join ld on ld.f = b.f
  left join ev_prev pv on pv.f = b.f
  left join ld_prev pl on pl.f = b.f
$$;

-- Источники, устройства, язык и креативы: посетитель — по первому событию в периоде.
create or replace function private.stats_visitors(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with v as (
    select distinct on (e.visitor_id) e.visitor_id, e.source, e.medium, e.content, e.device, e.lang
    from public.events e
    where e.at >= p_from and e.at < p_to
    order by e.visitor_id, e.at, e.id
  ),
  creative_visitors as (
    select v.content, count(*) as visitors, mode() within group (order by v.source) as source,
           mode() within group (order by v.medium) as medium
    from v where v.content is not null group by v.content
  ),
  creative_leads as (
    select l.content as content, count(*) as leads,
           mode() within group (order by l.source) as source,
           mode() within group (order by l.medium) as medium
    from private.stats_leads l
    where l.created_at >= p_from and l.created_at < p_to and l.content is not null
    group by 1
  )
  select jsonb_build_object(
    'sources', (select coalesce(jsonb_agg(jsonb_build_object('source', s.source, 'visitors', s.n) order by s.n desc), '[]')
                from (select v.source, count(*) as n from v group by v.source order by n desc limit 100) as s),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object('device', d.device, 'visitors', d.n) order by d.n desc), '[]')
                from (select v.device, count(*) as n from v group by v.device) as d),
    'langs', (select coalesce(jsonb_agg(jsonb_build_object('lang', g.lang, 'visitors', g.n) order by g.n desc), '[]')
              from (select v.lang, count(*) as n from v group by v.lang) as g),
    'creatives', (select coalesce(jsonb_agg(c order by (c ->> 'visitors')::integer desc, (c ->> 'leads')::integer desc), '[]')
                  from (select jsonb_build_object(
                          'content', coalesce(cv.content, cl.content),
                          'source', coalesce(cv.source, cl.source), 'medium', coalesce(cv.medium, cl.medium),
                          'visitors', coalesce(cv.visitors, 0), 'leads', coalesce(cl.leads, 0)) as c
                        from creative_visitors cv full join creative_leads cl on cl.content = cv.content
                        order by coalesce(cv.visitors, 0) desc, coalesce(cl.leads, 0) desc
                        limit 20) as top)
  )
$$;

-- Популярные ЖК и застройщики: просмотры страниц ЖК (complex_view) и заявки по ним.
create or replace function private.stats_objects(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with views as (
    select e.entity_id as id, count(*) as n
    from public.events e
    where e.at >= p_from and e.at < p_to and e.type = 'complex_view' and e.entity_type = 'complex'
    group by 1
  ),
  leads as (
    select l.complex_id as id, count(*) as n
    from private.stats_leads l
    where l.created_at >= p_from and l.created_at < p_to and l.complex_id is not null
    group by 1
  ),
  complexes as (
    select c.id, c.slug, c.name, c.developer_id, coalesce(v.n, 0) as views, coalesce(l.n, 0) as leads
    from views v
    full join leads l on l.id = v.id
    join public.complexes c on c.id = coalesce(v.id, l.id)
  ),
  dev_leads as (
    select coalesce(l.developer_id, c.developer_id) as id, count(*) as n
    from private.stats_leads l
    left join public.complexes c on c.id = l.complex_id
    where l.created_at >= p_from and l.created_at < p_to and coalesce(l.developer_id, c.developer_id) is not null
    group by 1
  ),
  dev_views as (
    select x.developer_id as id, sum(x.views) as n from complexes x group by 1
  ),
  developers as (
    select d.id, d.slug, d.name, coalesce(v.n, 0) as views, coalesce(l.n, 0) as leads
    from dev_views v
    full join dev_leads l on l.id = v.id
    join public.developers d on d.id = coalesce(v.id, l.id)
  )
  select jsonb_build_object(
    'complexes', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'views', t.views, 'leads', t.leads)
                                            order by t.views desc, t.leads desc), '[]')
                  from (select * from complexes order by views desc, leads desc, slug limit 20) as t),
    'developers', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'views', t.views, 'leads', t.leads)
                                             order by t.views desc, t.leads desc), '[]')
                   from (select * from developers order by views desc, leads desc, slug limit 20) as t)
  )
$$;

create or replace function public.site_stats(p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Tashkent')::date;
  v_days integer;
  v_from timestamptz;
  v_until timestamptz;
  v_shift interval;
  v_hourly boolean;
begin
  if not private.has_role('head') then
    raise exception 'Статистику видит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  -- События хранятся 400 дней (cleanup_events): раньше — пустые дни, а не «ноль посетителей».
  if p_from is null or p_to is null or p_from > p_to or p_to > v_today or p_from < v_today - 400 then
    raise exception 'Период статистики: с % по %', p_from, p_to using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  v_days := p_to - p_from + 1;
  v_from := p_from::timestamp at time zone 'Asia/Tashkent';
  v_until := least((p_to + 1)::timestamp at time zone 'Asia/Tashkent', now());
  v_shift := make_interval(days => v_days);
  v_hourly := v_days = 1;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'until', v_until, 'hourly', v_hourly,
    'prev_from', p_from - v_days, 'prev_to', p_to - v_days,
    'totals', private.stats_totals(v_from, v_until),
    'prev', private.stats_totals(v_from - v_shift, v_until - v_shift),
    -- Прошлый период целиком в сроке хранения событий — иначе неполный и «рост» ложный.
    'prev_has_data', p_from - v_days >= v_today - 400
      and exists (select 1 from public.events e where e.at >= v_from - v_shift and e.at < v_until - v_shift),
    'series', private.stats_series(v_from, v_until, case when v_hourly then 24 else v_days end,
                                   case when v_hourly then interval '1 hour' else interval '1 day' end, v_shift),
    'lead_types', (select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'leads', t.n) order by t.n desc, t.type), '[]')
                   from (select l.type, count(*) as n from private.stats_leads l
                         where l.created_at >= v_from and l.created_at < v_until group by l.type) as t)
  ) || private.stats_visitors(v_from, v_until) || private.stats_objects(v_from, v_until);
end;
$$;

comment on function public.site_stats(date, date) is
  'Статистика сайта за дни по Ташкенту (фаза 6, мокап CabStats) — только руководитель.';

revoke all on function private.stats_totals(timestamptz, timestamptz),
  private.stats_series(timestamptz, timestamptz, integer, interval, interval),
  private.stats_visitors(timestamptz, timestamptz),
  private.stats_objects(timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.site_stats(date, date) from public, anon;
grant execute on function public.site_stats(date, date) to authenticated;
