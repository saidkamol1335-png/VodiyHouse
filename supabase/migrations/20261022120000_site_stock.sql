-- Фаза 1 · шаг 13: главная кабинета «Остатки по ЖК» (Г3 B — по блокам в раскрытии строки).
-- Панель перечитывает остатки всех ЖК на сайте раз в минуту (Г4 A): block_availability по одному
-- ЖК дала бы N запросов на каждое чтение. Теперь она, как room_availability, принимает массив ЖК
-- и отдаёт complex_id; страница ЖК сайта (фаза 3) зовёт её с одним id. Перегрузку не оставляем:
-- PostgREST ищет функцию по именам аргументов (tests/db/rpc-contract.test.ts).

drop function public.block_availability(uuid);

-- «Бл. A: 12 · Бл. B: 29»: свободные по блокам, включая квартиры, которым ещё не назначена
-- планировка. У блока без списка квартир числа нет — только «есть ли что предложить» по флагу
-- «доступна» его планировок (иначе «по планировкам» и «нет в наличии» не различить).
create function public.block_availability(complex_ids uuid[])
returns table (
  complex_id uuid,
  block_id uuid,
  name text,
  -- null — у блока нет списка квартир.
  free_count integer,
  available boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.complex_id,
    b.id,
    b.name,
    case when listed.units > 0 then listed.free end,
    case
      when listed.units > 0 then listed.free > 0
      else exists (select 1 from public.layouts l where l.block_id = b.id and l.available)
    end
  from public.blocks b
  cross join lateral (
    select
      count(*)::integer as units,
      (count(*) filter (where u.status = 'free'))::integer as free
    from public.units u
    where u.block_id = b.id
  ) listed
  where b.complex_id = any (complex_ids) and private.can_see_complex(b.complex_id)
  order by b.complex_id, b.sort, b.name
$$;

revoke all on function public.block_availability(uuid[]) from public;
grant execute on function public.block_availability(uuid[]) to anon, authenticated, service_role;
