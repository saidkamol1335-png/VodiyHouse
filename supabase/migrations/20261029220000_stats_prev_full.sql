-- Фаза 6, ревью блока 6B: «Сегодня» ночью (00:40) — у вчера до 00:40 событий нет, и prev_has_data
-- прятал пунктир «вчера», «вчера: N» в подсказке, строку прошлого периода в CSV и писал «за вчера
-- данных нет», хотя вчера есть. Теперь «прошлый период есть» = он в сроке хранения и за весь прошлый
-- период есть события; изменения KPI считаются, как раньше, «на это же время» (ноль — «нет данных»).
-- Тело site_stats — как в 20261029200000, кроме проверки prev_has_data.

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
    -- Прошлый период целиком в сроке хранения событий — иначе неполный и «рост» ложный; данные —
    -- за весь прошлый период, не только «до этого же времени» (ночью вчера до 00:40 пусто).
    'prev_has_data', p_from - v_days >= v_today - 400
      and exists (select 1 from public.events e where e.at >= v_from - v_shift and e.at < v_from),
    'series', private.stats_series(v_from, v_until, case when v_hourly then 24 else v_days end,
                                   case when v_hourly then interval '1 hour' else interval '1 day' end, v_shift),
    'lead_types', (select coalesce(jsonb_agg(jsonb_build_object('type', t.type, 'leads', t.n) order by t.n desc, t.type), '[]')
                   from (select l.type, count(*) as n from private.stats_leads l
                         where l.created_at >= v_from and l.created_at < v_until group by l.type) as t)
  ) || private.stats_visitors(v_from, v_until) || private.stats_objects(v_from, v_until);
end;
$$;
