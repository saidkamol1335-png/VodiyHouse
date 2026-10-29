-- «Выбрать квартиру» (фаза 4, ответ заказчика 29.10): как часто раздел перечитывает статусы квартир —
-- по числу посетителей онлайн (меньше 10 — раз в минуту, от 10 — раз в 30 с, больше 50 — раз в 15 с).
-- Онлайн — как «Онлайн на сайте» в кабинете (site_now): разные посетители за последние 5 минут.
-- Только серверу: число посетителей сайта — не для чужих глаз; сервер держит ответ 30 с.

create function public.site_online_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct e.visitor_id)::integer
  from public.events e
  where e.at > now() - interval '5 minutes'
$$;

comment on function public.site_online_count() is
  'Посетителей сайта за 5 минут — частота обновления статусов в «Выбрать квартиру» (только серверу).';

revoke all on function public.site_online_count() from public, anon, authenticated;
grant execute on function public.site_online_count() to service_role;
