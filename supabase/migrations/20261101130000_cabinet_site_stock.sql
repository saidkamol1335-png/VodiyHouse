-- Правило публикации v2, блок C: главная кабинета «столько видят клиенты на сайте» считает только
-- полные планировки. room_availability и block_availability остаются полными: их читают список ЖК и
-- вкладки, где неполное нужно видеть. Столбцы — те же, разбор на главной не меняется.

create function public.site_room_stock(complex_ids uuid[])
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
    coalesce(sum(o.free_count), 0)::integer,
    bool_or(o.available),
    min(o.area) filter (where o.available),
    min(o.price_from) filter (where o.available)
  from private.site_layout_offers o
  where o.complex_id = any (complex_ids) and private.is_staff()
  group by o.complex_id, o.rooms, o.currency
  order by o.complex_id, o.rooms, o.currency
$$;

create function public.site_block_stock(complex_ids uuid[])
returns table (
  complex_id uuid,
  block_id uuid,
  name text,
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
    case when listed.has_units then coalesce(offers.free, 0) end,
    0,
    coalesce(offers.available, false)
  from public.blocks b
  cross join lateral (
    select exists (select 1 from public.units u where u.block_id = b.id) as has_units
  ) listed
  left join lateral (
    select sum(o.free_count)::integer as free, bool_or(o.available) as available
    from private.site_layout_offers o
    where o.block_id = b.id
  ) offers on true
  where b.complex_id = any (complex_ids) and private.is_staff()
  order by b.complex_id, b.sort, b.name
$$;

comment on function public.site_room_stock(uuid[]) is
  'Главная кабинета: наличие по комнатам, как его видит сайт — только полные планировки.';
comment on function public.site_block_stock(uuid[]) is
  'Главная кабинета: наличие по блокам, как его видит сайт — только полные планировки.';

revoke all on function public.site_room_stock(uuid[]), public.site_block_stock(uuid[]) from public, anon;
grant execute on function public.site_room_stock(uuid[]), public.site_block_stock(uuid[]) to authenticated;
