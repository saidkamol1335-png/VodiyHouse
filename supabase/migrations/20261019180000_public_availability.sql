-- Фаза 1 · шаг 4: наличие квартир для сайта (PLAN §5, задача 6 «осталось N шт.»).
-- Посетитель не читает таблицу квартир: только эти функции. Они отдают опубликованные ЖК
-- (сотрудникам — любые, для предпросмотра), статус в трёх значениях и никаких полей сотрудников.
-- Цены — без округления: округляет вывод (lib/format, PLAN §0.10).

-- ─── Наличие по планировкам ──────────────────────────────────────────────────────────────

-- Блок со списком квартир считает «осталось N» по свободным квартирам. Блок без списка —
-- ручной флаг «доступна» и «цена от» планировки, без числа (PLAN §3.1).
-- «Цена от» — минимум по свободным квартирам с ценой, иначе ручная цена планировки.
create view private.layout_offers as
select
  l.id as layout_id,
  l.block_id,
  b.complex_id,
  b.currency,
  l.rooms,
  l.area,
  listed.has_units,
  case when listed.has_units then free.free_count end as free_count,
  case when listed.has_units then free.free_count > 0 else l.available end as available,
  case
    when listed.has_units and free.free_count > 0 then coalesce(free.min_price, l.price_from)
    when not listed.has_units and l.available then l.price_from
  end as price_from,
  b.sort as block_sort,
  b.name as block_name,
  l.sort
from public.layouts l
join public.blocks b on b.id = l.block_id
cross join lateral (
  select exists (select 1 from public.units u where u.block_id = l.block_id) as has_units
) listed
cross join lateral (
  select
    count(*)::integer as free_count,
    min(coalesce(u.price, u.price_per_m2 * l.area)) as min_price
  from public.units u
  where u.layout_id = l.id and u.status = 'free'
) free;

revoke all on private.layout_offers from public, anon, authenticated;

-- Сайт видит опубликованный ЖК; сотрудники — любой (предпросмотр черновика, фаза 3).
create function private.can_see_complex(complex uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.is_public_complex(complex) or private.is_staff()
$$;

revoke all on function private.can_see_complex(uuid) from public;
grant execute on function private.can_see_complex(uuid) to anon, authenticated, service_role;

-- Раздел «Планировки» страницы ЖК: «осталось N шт.» и «цена от» у каждой планировки.
create function public.layout_availability(target_complex uuid)
returns table (
  layout_id uuid,
  block_id uuid,
  rooms smallint,
  area numeric,
  -- null — у блока нет списка квартир: число не показываем.
  free_count integer,
  available boolean,
  price_from numeric,
  currency public.currency
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.layout_id, o.block_id, o.rooms, o.area, o.free_count, o.available, o.price_from, o.currency
  from private.layout_offers o
  where o.complex_id = target_complex and private.can_see_complex(target_complex)
  order by o.block_sort, o.block_name, o.rooms, o.area, o.sort
$$;

-- Карточки каталога и «Наличие квартир»: по типу (числу комнат) для нескольких ЖК сразу.
-- Число неизвестно, если тип есть в доступной планировке блока без списка квартир.
create function public.room_availability(complex_ids uuid[])
returns table (
  complex_id uuid,
  rooms smallint,
  currency public.currency,
  free_count integer,
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
    bool_or(o.available),
    min(o.area) filter (where o.available),
    min(o.price_from) filter (where o.available)
  from private.layout_offers o
  where o.complex_id = any (complex_ids) and private.can_see_complex(o.complex_id)
  group by o.complex_id, o.rooms, o.currency
  order by o.complex_id, o.rooms, o.currency
$$;

-- «41 в продаже сейчас · Бл. A: 12 · Бл. B: 29» (мокап): свободные по блокам, включая
-- квартиры, которым ещё не назначена планировка.
create function public.block_availability(target_complex uuid)
returns table (
  block_id uuid,
  name text,
  -- null — у блока нет списка квартир.
  free_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    b.id,
    b.name,
    case when count(u.id) > 0 then (count(u.id) filter (where u.status = 'free'))::integer end
  from public.blocks b
  left join public.units u on u.block_id = b.id
  where b.complex_id = target_complex and private.can_see_complex(target_complex)
  group by b.id, b.name, b.sort
  order by b.sort, b.name
$$;

-- Квартиры блока для выбора на фасаде и плане этажа (фаза 4): статус в трёх значениях,
-- цена — только у свободных; без отделки, авторов и дат изменения.
create function public.block_units(target_block uuid)
returns table (
  unit_id uuid,
  entrance smallint,
  floor smallint,
  "position" smallint,
  number text,
  layout_id uuid,
  rooms smallint,
  area numeric,
  status public.unit_status,
  price numeric,
  currency public.currency
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    u.id,
    u.entrance,
    u.floor,
    u.position,
    u.number,
    u.layout_id,
    l.rooms,
    l.area,
    u.status,
    case when u.status = 'free' then coalesce(u.price, u.price_per_m2 * l.area) end,
    b.currency
  from public.units u
  join public.blocks b on b.id = u.block_id
  left join public.layouts l on l.id = u.layout_id
  where u.block_id = target_block and private.can_see_complex(b.complex_id)
  order by u.entrance, u.floor desc, u.position
$$;

revoke all on function
  public.layout_availability(uuid),
  public.room_availability(uuid[]),
  public.block_availability(uuid),
  public.block_units(uuid)
from public;
grant execute on function
  public.layout_availability(uuid),
  public.room_availability(uuid[]),
  public.block_availability(uuid),
  public.block_units(uuid)
to anon, authenticated, service_role;
