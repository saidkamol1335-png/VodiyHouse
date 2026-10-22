-- Фаза 1 · шаг 13: главная кабинета «Остатки по ЖК» (Г3 B — по типам и по блокам в раскрытии).
-- Панель перечитывает остатки всех ЖК на сайте раз в минуту (Г4 A): block_availability по одному
-- ЖК дала бы N запросов на каждое чтение. Теперь она, как room_availability, принимает массив ЖК
-- и отдаёт complex_id; страница ЖК сайта (фаза 3) зовёт её с одним id. Перегрузку не оставляем:
-- PostgREST ищет функцию по именам аргументов (tests/db/rpc-contract.test.ts).

-- ─── По типам: известная часть числа ─────────────────────────────────────────────────────
-- «Осталось N» типа по-прежнему null, если тип есть в доступной планировке блока без списка
-- квартир (число неизвестно, PLAN §3.1). Но свободные этого типа в блоках со списком известны:
-- без них «свободно N+» у ЖК, где один блок со списком, а другой по планировкам, теряло бы и их
-- (ревью шага 13). listed_free — эта известная часть; у типа без блоков без списка она равна
-- free_count.

drop function public.room_availability(uuid[]);

create function public.room_availability(complex_ids uuid[])
returns table (
  complex_id uuid,
  rooms smallint,
  currency public.currency,
  free_count integer,
  listed_free integer,
  available boolean,
  area_from numeric,
  price_from numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.complex_id,
    o.rooms,
    o.currency,
    case
      when bool_or(not o.has_units and o.available) then null
      else coalesce(sum(o.free_count), 0)::integer
    end,
    -- free_count у планировки блока без списка — null, sum его пропускает.
    coalesce(sum(o.free_count), 0)::integer,
    bool_or(o.available),
    min(o.area) filter (where o.available),
    min(o.price_from) filter (where o.available)
  from private.layout_offers o
  where o.complex_id = any (complex_ids) and private.can_see_complex(o.complex_id)
  group by o.complex_id, o.rooms, o.currency
  order by o.complex_id, o.rooms, o.currency
$$;

revoke all on function public.room_availability(uuid[]) from public;
grant execute on function public.room_availability(uuid[]) to anon, authenticated, service_role;

-- ─── По блокам ───────────────────────────────────────────────────────────────────────────

drop function public.block_availability(uuid);

-- «Бл. A: 12 · Бл. B: 29»: свободные по блокам, включая квартиры, которым ещё не назначена
-- планировка (free_unassigned — их отдельно: в типах их нет, и кабинет говорит об этом; считаются
-- тем же запросом, а не вычитанием из типов — два чтения не совпали бы по времени). У блока без
-- списка квартир числа нет — только «есть ли что предложить» по флагу «доступна» его планировок
-- (иначе «по планировкам» и «нет в наличии» не различить).
create function public.block_availability(complex_ids uuid[])
returns table (
  complex_id uuid,
  block_id uuid,
  name text,
  -- null — у блока нет списка квартир.
  free_count integer,
  free_unassigned integer,
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
    listed.unassigned,
    case
      when listed.units > 0 then listed.free > 0
      else exists (select 1 from public.layouts l where l.block_id = b.id and l.available)
    end
  from public.blocks b
  cross join lateral (
    select
      count(*)::integer as units,
      (count(*) filter (where u.status = 'free'))::integer as free,
      (count(*) filter (where u.status = 'free' and u.layout_id is null))::integer as unassigned
    from public.units u
    where u.block_id = b.id
  ) listed
  where b.complex_id = any (complex_ids) and private.can_see_complex(b.complex_id)
  order by b.complex_id, b.sort, b.name
$$;

revoke all on function public.block_availability(uuid[]) from public;
grant execute on function public.block_availability(uuid[]) to anon, authenticated, service_role;
