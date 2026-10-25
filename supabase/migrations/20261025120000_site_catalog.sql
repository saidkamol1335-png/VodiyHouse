-- Фаза 3 · шаг 3.3: каталог сайта одним запросом (решение фазы 3 «Данные»: одна кэшированная
-- функция базы и фильтр в браузере — до ~100 ЖК). Карточка и фильтр мокапа (.jc, .flt): ЖК
-- опубликованного застройщика, первые фото галереи, по блокам — срок, этажность, отделка; по
-- комнатам блока — свободно N, площадь и цена «от»; сверху — курс (Ф6) и программы застройщиков
-- для способов оплаты и «Платёж от» (lib/calc paymentFrom). Наличие и «цена от» — те же, что у
-- страницы ЖК (private.layout_offers); без полей сотрудников и без скидок (private.site_program).

-- Фото карточки: первые пять галереи по порядку (первое — обложка).
create function private.catalog_photos(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'path', m.path, 'width', m.width, 'height', m.height, 'blur', m.blur,
      'focus_x', m.focus_x, 'focus_y', m.focus_y, 'alt', m.alt)
    order by m.sort, m.created_at), '[]'::jsonb)
  from (
    select *
    from public.media_assets a
    where a.complex_id = p_complex and a.kind = 'photo'
    order by a.sort, a.created_at
    limit 5
  ) m
$$;

-- Комнаты блока: свободно N (null — блок без списка квартир, число неизвестно, PLAN §3.1),
-- площадь, цена и цена за м² «от» — по доступным планировкам; тип без доступных — available false.
create function private.catalog_offers(p_block uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'rooms', o.rooms, 'available', o.available, 'free', o.free_count,
      'area_from', o.area_from, 'price_from', o.price_from, 'price_per_m2_from', o.ppm_from)
    order by o.rooms), '[]'::jsonb)
  from (
    select
      l.rooms,
      bool_or(l.available) as available,
      case
        when bool_or(not l.has_units and l.available) then null
        else coalesce(sum(l.free_count), 0)::integer
      end as free_count,
      min(l.area) filter (where l.available) as area_from,
      min(l.price_from) filter (where l.available) as price_from,
      min(l.price_from / l.area) filter (where l.available and l.price_from is not null) as ppm_from
    from private.layout_offers l
    where l.block_id = p_block
    group by l.rooms
  ) o
$$;

create function private.catalog_blocks(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'currency', b.currency, 'build_status', b.build_status,
      'deadline_year', b.deadline_year, 'deadline_quarter', b.deadline_quarter,
      'floors_total', b.floors_total,
      'finishing', (select jsonb_build_object('slug', f.slug, 'name', f.name)
                    from public.finishings f where f.id = b.finishing_id),
      'offers', private.catalog_offers(b.id))
    order by b.sort, b.name), '[]'::jsonb)
  from public.blocks b
  where b.complex_id = p_complex
$$;

create function public.site_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with shown as (
    select c.*, d.programs_checked_at
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.status = 'published' and d.status = 'published'
  )
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'developers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', d.id, 'slug', d.slug, 'name', d.name,
          'programs', (
            select coalesce(jsonb_agg(private.site_program(p, d.programs_checked_at)
              order by p.sort, p.created_at), '[]'::jsonb)
            from public.payment_programs p
            where p.developer_id = d.id and p.is_active
              and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)))
        order by d.sort, d.name)
      from public.developers d
      where d.status = 'published' and exists (select 1 from shown s where s.developer_id = d.id)
    ), '[]'::jsonb),
    'complexes', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'slug', s.slug, 'name', s.name, 'class', s.class, 'sort', s.sort,
          'developer_id', s.developer_id,
          'location', (select jsonb_build_object('slug', l.slug, 'kind', l.kind, 'name', l.name)
                       from public.locations l where l.id = s.location_id),
          'address', s.address, 'landmark', s.landmark, 'minutes_to_center', s.minutes_to_center,
          'checked', jsonb_build_object(
            'permit', s.permit_checked_at, 'land', s.land_checked_at, 'visit', s.staff_visited_at),
          'created_at', s.created_at,
          'photos', private.catalog_photos(s.id),
          'blocks', private.catalog_blocks(s.id))
        order by s.sort, s.name ->> 'ru')
      from shown s
    ), '[]'::jsonb)
  )
$$;

comment on function public.site_catalog() is
  'Каталог сайта (шаг 3.3): курс, программы опубликованных застройщиков без скидок, опубликованные ЖК с фото, блоками и наличием по комнатам.';

revoke all on function
  private.catalog_photos(uuid),
  private.catalog_offers(uuid),
  private.catalog_blocks(uuid),
  public.site_catalog()
from public;
grant execute on function public.site_catalog() to anon, authenticated, service_role;
