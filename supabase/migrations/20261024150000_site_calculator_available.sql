-- Пункт «Калькулятор» в меню сайта (решение фазы 2 «Пустые состояния», приёмка 2.9): есть ли хоть
-- один застройщик, которого показал бы site_calc_screen(). Отдельной функцией, а не через
-- site_calc_screen(null): её читает layout каждой страницы сайта, нужен один boolean, а не программы
-- и ЖК первого застройщика. Условие — то же, что listed в site_calc_screen
-- (20261024100000_payment_programs.sql); совпадение проверяет tests/db/site-calc.test.ts.
create function public.site_calculator_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.developers d
    where d.status = 'published'
      and exists (
        select 1 from public.payment_programs p
        where p.developer_id = d.id and p.is_active
          and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)));
$$;

comment on function public.site_calculator_available() is
  'Меню сайта: есть ли опубликованный застройщик с программами — пункт «Калькулятор».';

revoke all on function public.site_calculator_available() from public;
grant execute on function public.site_calculator_available() to anon, authenticated, service_role;
