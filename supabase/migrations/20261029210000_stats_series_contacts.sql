-- Фаза 6 (6B.4, CSV статистики — мокап CabStats: «Дата;Посетители;Визиты;Просмотры;Заявки;Контакты»):
-- в точке графика — ещё и «Показали телефон / Telegram» (разные посетители за день или час). Тело —
-- как в 20261029200000, плюс contacts в текущей и прошлой точке.

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
           count(*) filter (where e.type = 'page_view') as views,
           count(distinct e.visitor_id) filter (where e.type in ('phone_click', 'telegram_click')) as contacts
    from public.events e
    where e.at >= p_from and e.at < p_until
    group by 1
  ),
  ev_prev as (
    select date_bin(p_step, e.at, p_from - p_shift) + p_shift as f,
           count(distinct e.visitor_id) as visitors, count(distinct e.session_id) as visits,
           count(*) filter (where e.type = 'page_view') as views,
           count(distinct e.visitor_id) filter (where e.type in ('phone_click', 'telegram_click')) as contacts
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
      'views', coalesce(ev.views, 0), 'leads', coalesce(ld.leads, 0), 'contacts', coalesce(ev.contacts, 0)) end,
    'prev', jsonb_build_object(
      'visitors', coalesce(pv.visitors, 0), 'visits', coalesce(pv.visits, 0),
      'views', coalesce(pv.views, 0), 'leads', coalesce(pl.leads, 0), 'contacts', coalesce(pv.contacts, 0))
  ) order by b.i), '[]')
  from buckets b
  left join ev on ev.f = b.f
  left join ld on ld.f = b.f
  left join ev_prev pv on pv.f = b.f
  left join ld_prev pl on pl.f = b.f
$$;


-- KPI руководителя на Главной (мокап CabHome: «Сайт сегодня · N посетителей · онлайн сейчас M» → статистика
-- «Сегодня»): только число разных посетителей с полуночи по Ташкенту — site_stats ради одной цифры
-- на каждой загрузке Главной слишком тяжела. Онлайн Главная берёт из site_now().
create function public.site_today()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Статистику видит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  return (select count(distinct e.visitor_id)::integer
          from public.events e
          where e.at >= private.tashkent_today()::timestamp at time zone 'Asia/Tashkent');
end;
$$;

comment on function public.site_today() is 'Посетителей сайта с полуночи по Ташкенту — KPI руководителя на Главной (фаза 6).';

revoke all on function public.site_today() from public, anon;
grant execute on function public.site_today() to authenticated;
