-- Правило публикации v2 (docs/publication-rule.md, решение заказчика 01.11.2026; определения —
-- docs/progress/publication-v2.md). Минимум ЖК без планировок и города; полнота планировки; сайт
-- видит только полные. Состояние draft / soon / full считается при чтении: status остаётся отметкой
-- руководителя, «опубликован» значит «минимум выполнен» — это держат стражи ниже.

-- ─── Застройщик необязателен у черновика (раздел D) ──────────────────────────────────────
alter table public.complexes
  alter column developer_id drop not null,
  add constraint complexes_developer_required
    check (developer_id is not null or status in ('draft', 'archived'));

-- ─── Тип фото галереи (минимум ЖК, п. 4) ─────────────────────────────────────────────────
-- general — общий рендер ЖК (фасад, двор, вид сверху); apartment — рендер квартиры; real —
-- настоящее фото. В минимум идут только general.
alter table public.media_assets
  add column photo_category text not null default 'general'
    check (photo_category in ('general', 'apartment', 'real'));

-- ─── Минимум ЖК ──────────────────────────────────────────────────────────────────────────
-- Цифры совпадают с lib/admin/complexes/readiness.ts (тест сверяет). have — сколько общих рендеров
-- есть, кроме обложки. Обложка — первое фото галереи, как на сайте: настоящее фото первым не
-- считается обложкой. Название обязательно по схеме, поэтому пункт address проверяет только адрес.
create or replace function private.complex_requirements(p_complex uuid, p_row public.complexes default null)
returns table (requirement text, ok boolean, have integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.complexes;
  cover public.media_assets;
  general_count integer;
  others integer;
  has_program boolean;
begin
  if p_row is null then
    select * into r from public.complexes c where c.id = p_complex;
  else
    r := p_row;
  end if;
  select * into cover
    from public.media_assets m
    where m.complex_id = p_complex and m.kind = 'photo'
    order by m.sort, m.created_at, m.id
    limit 1;
  select count(*)::integer into general_count
    from public.media_assets m
    where m.complex_id = p_complex and m.kind = 'photo' and m.photo_category = 'general';
  others := general_count - case when cover.photo_category = 'general' then 1 else 0 end;
  has_program := exists (
    select 1 from public.payment_programs p
    where p.developer_id = r.developer_id and p.is_active
      and (p.blocks_scope = 'all' or exists (
        select 1 from public.blocks b where b.complex_id = p_complex and b.id = any (p.block_ids)))
  );

  return query
  select x.requirement, x.ok, x.have
  from (values
    (1, 'address', r.address is not null, null::integer),
    (2, 'point', r.lat is not null and r.lng is not null, null::integer),
    (3, 'developer', exists (
      select 1 from public.developers d where d.id = r.developer_id and d.status = 'published'
    ), null::integer),
    (4, 'renders', coalesce(
      cover.photo_category = 'general' and greatest(cover.width, cover.height) >= 2400 and others >= 4, false
    ), others),
    (5, 'blocks', exists (
      select 1 from public.blocks b where b.complex_id = p_complex and b.deadline_year is not null
    ), null::integer),
    (6, 'payment', has_program and private.exchange_rate() is not null, null::integer)
  ) as x (ord, requirement, ok, have)
  order by x.ord;
end;
$$;

create or replace function private.assert_complex_not_worse(p_complex uuid, p_before text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  worse text[];
begin
  if not exists (select 1 from public.complexes c where c.id = p_complex and c.status = 'published') then
    return;
  end if;
  worse := array(
    select unnest(private.complex_missing(p_complex)) except select unnest(p_before)
  );
  if cardinality(worse) > 0 then
    raise exception 'Обязательный пункт опубликованного ЖК нельзя убрать — сначала нажмите «Скрыть»'
      using errcode = 'check_violation', hint = 'vh:not_ready', detail = array_to_string(worse, ',');
  end if;
end;
$$;

-- ─── Полнота планировки ──────────────────────────────────────────────────────────────────
-- Полная: чертёж от 1200 px и цена. В блоке со списком цена — у квартиры этой планировки в любом
-- статусе (проданная остаётся на сайте как «нет в наличии», интервью 01.11); в блоке без списка —
-- ручная (Н7). Комнаты и площадь обязательны по схеме. private.layout_offers не меняется: её
-- читает кабинет.
create view private.layout_completeness as
select
  l.id as layout_id,
  l.block_id,
  b.complex_id,
  listed.has_units,
  priced.free_priced,
  priced.min_free,
  coalesce(greatest(m.width, m.height) >= 1200, false) as has_drawing,
  case when listed.has_units then priced.any_priced else coalesce(l.price_from > 0, false) end as has_price,
  coalesce(greatest(m.width, m.height) >= 1200, false)
    and case when listed.has_units then priced.any_priced else coalesce(l.price_from > 0, false) end as is_complete
from public.layouts l
join public.blocks b on b.id = l.block_id
left join public.media_assets m on m.id = l.drawing_id
cross join lateral (
  select exists (select 1 from public.units u where u.block_id = l.block_id) as has_units
) listed
cross join lateral (
  select
    coalesce(bool_or(p.price > 0), false) as any_priced,
    (count(*) filter (where p.status = 'free' and p.price > 0))::integer as free_priced,
    min(p.price) filter (where p.status = 'free' and p.price > 0) as min_free
  from (
    select u.status, coalesce(u.price, u.price_per_m2 * l.area) as price
    from public.units u
    where u.layout_id = l.id
  ) p
) priced;

revoke all on private.layout_completeness from public, anon, authenticated;

-- Предложения для сайта: только полные планировки, «осталось N» — только квартиры с ценой.
-- Те же столбцы, что у private.layout_offers.
create view private.site_layout_offers as
select
  c.layout_id,
  c.block_id,
  c.complex_id,
  b.currency,
  l.rooms,
  l.area,
  c.has_units,
  case when c.has_units then c.free_priced end as free_count,
  case when c.has_units then c.free_priced > 0 else l.available end as available,
  case
    when c.has_units then c.min_free
    when l.available then l.price_from
  end as price_from,
  b.sort as block_sort,
  b.name as block_name,
  l.sort
from private.layout_completeness c
join public.layouts l on l.id = c.layout_id
join public.blocks b on b.id = c.block_id
where c.is_complete;

revoke all on private.site_layout_offers from public, anon, authenticated;

-- soon | full: что покажет сайт. Черновик на сайт не попадает, предпросмотр руководителя рисует
-- будущую страницу. Распроданный ЖК остаётся полным.
create function private.complex_site_view(p_complex uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from private.layout_completeness c where c.complex_id = p_complex and c.is_complete)
      then 'full'
    else 'soon'
  end
$$;

revoke all on function private.complex_site_view(uuid) from public, anon, authenticated;

-- ─── Сайт: каталог и страница ЖК ─────────────────────────────────────────────────────────
-- Тела — как в 20261025120000, 20261025180000 и 20261025220000; меняются источник предложений и
-- ключ state.

create or replace function private.catalog_offers(p_block uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'rooms', o.rooms, 'available', o.available, 'free', o.free_count,
      'area_from', o.area_from, 'price_from', o.price_from, 'price_to', o.price_to,
      'price_per_m2_from', o.ppm_from)
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
      max(coalesce(top.max_price, l.price_from)) filter (where l.available) as price_to,
      min(l.price_from / l.area) filter (where l.available and l.price_from is not null) as ppm_from
    from private.site_layout_offers l
    cross join lateral (
      select max(coalesce(u.price, u.price_per_m2 * l.area)) as max_price
      from public.units u
      where u.layout_id = l.layout_id and u.status = 'free'
    ) top
    where l.block_id = p_block
    group by l.rooms
  ) o
$$;

create or replace function public.site_catalog()
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
          'state', private.complex_site_view(s.id),
          'developer_id', s.developer_id,
          'location', (select jsonb_build_object('slug', l.slug, 'kind', l.kind, 'name', l.name)
                       from public.locations l where l.id = s.location_id),
          'address', s.address, 'landmark', s.landmark, 'minutes_to_center', s.minutes_to_center,
          'checked', jsonb_build_object(
            'permit', private.complex_document_on(s.id, 'permit'),
            'land', private.complex_document_on(s.id, 'land'),
            'visit', s.staff_visited_at),
          'created_at', s.created_at,
          'photos', private.catalog_photos(s.id),
          'blocks', private.catalog_blocks(s.id))
        order by s.sort, s.name ->> 'ru')
      from shown s
    ), '[]'::jsonb)
  )
$$;

-- free — свободные квартиры полных планировок с ценой; null — у блока нет списка квартир.
create or replace function private.complex_page_blocks(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'currency', b.currency, 'build_status', b.build_status,
      'progress_pct', b.progress_pct, 'floors_total', b.floors_total, 'floors_built', b.floors_built,
      'deadline_year', b.deadline_year, 'deadline_quarter', b.deadline_quarter,
      'finishing', (select jsonb_build_object('slug', f.slug, 'name', f.name, 'description', f.description)
                    from public.finishings f where f.id = b.finishing_id),
      'cadastre', b.cadastre, 'cadastre_expected_on', b.cadastre_expected_on,
      'price_includes', b.price_includes,
      'free', (select case when exists (select 1 from public.units u where u.block_id = b.id)
                 then coalesce(sum(o.free_count), 0)::integer end
               from private.site_layout_offers o where o.block_id = b.id),
      'offers', private.catalog_offers(b.id),
      'deadline_history', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'from_year', h.from_year, 'from_quarter', h.from_quarter,
            'to_year', h.to_year, 'to_quarter', h.to_quarter, 'changed_on', h.changed_on)
          order by h.changed_on, h.created_at), '[]'::jsonb)
        from public.deadline_changes h where h.block_id = b.id))
    order by b.sort, b.name), '[]'::jsonb)
  from public.blocks b
  where b.complex_id = p_complex
$$;

create or replace function private.complex_page_layouts(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.layout_id, 'block_id', o.block_id, 'rooms', o.rooms, 'area', o.area,
      'free', o.free_count, 'available', o.available, 'price_from', o.price_from,
      'floor_from', floors.low, 'floor_to', floors.high,
      'drawing', private.site_media(m))
    order by o.block_sort, o.block_name, o.rooms, o.area, o.sort), '[]'::jsonb)
  from private.site_layout_offers o
  join public.layouts l on l.id = o.layout_id
  left join public.media_assets m on m.id = l.drawing_id
  cross join lateral (
    select min(u.floor) as low, max(u.floor) as high from public.units u where u.layout_id = o.layout_id
  ) floors
  where o.complex_id = p_complex
$$;

create or replace function private.complex_page_others(p_complex uuid, p_developer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'name', c.name,
      'location', (select l.name from public.locations l where l.id = c.location_id),
      'photo', (select private.site_media(m) from public.media_assets m
                where m.complex_id = c.id and m.kind = 'photo'
                order by m.sort, m.created_at limit 1),
      'prices', (select coalesce(jsonb_agg(jsonb_build_object('currency', o.currency, 'price_from', o.price_from)), '[]'::jsonb)
                 from (select x.currency, min(x.price_from) as price_from
                       from private.site_layout_offers x
                       where x.complex_id = c.id and x.available and x.price_from is not null
                       group by x.block_id, x.currency) o))
    order by c.sort, c.name ->> 'ru'), '[]'::jsonb)
  from public.complexes c
  where c.developer_id = p_developer and c.id <> p_complex and private.is_public_complex(c.id)
$$;

create or replace function public.site_complex(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'complex', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'status', c.status,
      'state', private.complex_site_view(c.id),
      'on_site', private.is_public_complex(c.id),
      'short_description', c.short_description, 'class', c.class, 'house_type', c.house_type,
      'ceiling_height', c.ceiling_height, 'parking', c.parking,
      'location', (select jsonb_build_object('slug', l.slug, 'kind', l.kind, 'name', l.name)
                   from public.locations l where l.id = c.location_id),
      'address', c.address, 'landmark', c.landmark, 'minutes_to_center', c.minutes_to_center,
      'lat', c.lat, 'lng', c.lng, 'nearby', c.nearby,
      'checked', jsonb_build_object(
        'permit', private.complex_document_on(c.id, 'permit'),
        'land', private.complex_document_on(c.id, 'land'),
        'visit', c.staff_visited_at),
      'stock_updated_at', (
        select greatest(
          (select max(u.updated_at) from public.units u join public.blocks b on b.id = u.block_id
            where b.complex_id = c.id),
          (select max(l.updated_at) from public.layouts l join public.blocks b on b.id = l.block_id
            where b.complex_id = c.id)))),
    'developer', private.complex_page_developer(c.developer_id, c.id),
    'photos', (
      select coalesce(jsonb_agg(private.site_media(m) order by m.sort, m.created_at, m.id), '[]'::jsonb)
      from public.media_assets m where m.complex_id = c.id and m.kind = 'photo'),
    'blocks', private.complex_page_blocks(c.id),
    'layouts', private.complex_page_layouts(c.id),
    'others', private.complex_page_others(c.id, c.developer_id)
  ) || private.complex_page_content(c.id)
  from public.complexes c
  where c.slug = p_slug and (private.is_public_complex(c.id) or private.has_role('head'))
$$;

-- ─── Сайт: расчёт ────────────────────────────────────────────────────────────────────────

create or replace function public.site_layout_calc(p_layout uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'developer', jsonb_build_object('name', d.name, 'checked_at', d.programs_checked_at),
    'complex', jsonb_build_object('id', c.id, 'name', c.name),
    'block', jsonb_build_object('id', b.id, 'name', b.name, 'currency', b.currency),
    'layout', jsonb_build_object(
      'id', o.layout_id, 'rooms', o.rooms, 'area', o.area, 'price_from', o.price_from,
      'available', o.available, 'drawing', m.path),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'number', u.number, 'floor', u.floor,
        'price', coalesce(u.price, u.price_per_m2 * o.area)
      ) order by u.floor, u.number), '[]'::jsonb)
      from public.units u
      where u.layout_id = o.layout_id and u.status = 'free'
        and coalesce(u.price, u.price_per_m2 * o.area) > 0),
    'programs', (
      select coalesce(jsonb_agg(private.page_program(p, d.programs_checked_at, c.id)
        order by p.sort, p.created_at), '[]'::jsonb)
      from public.payment_programs p
      where p.developer_id = d.id and p.is_active
        and (p.blocks_scope = 'all' or b.id = any (p.block_ids)))
  )
  from private.site_layout_offers o
  join public.blocks b on b.id = o.block_id
  join public.complexes c on c.id = b.complex_id
  join public.developers d on d.id = c.developer_id
  join public.layouts l on l.id = o.layout_id
  left join public.media_assets m on m.id = l.drawing_id
  where o.layout_id = p_layout
    and (private.is_public_complex(c.id) or private.has_role('head'))
    and o.available and o.price_from > 0
$$;

-- Кабинет считает по всем планировкам, сайт (p_public) — только по полным.
create or replace function private.developer_price_hint(p_developer uuid, p_public boolean default false)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('per_m2', min(x.per_m2), 'currency', x.currency)
  from (
    select coalesce(u.price_per_m2, u.price / nullif(l.area, 0)) as per_m2, b.currency
    from public.units u
    join public.blocks b on b.id = u.block_id
    join public.complexes c on c.id = b.complex_id
    left join public.layouts l on l.id = u.layout_id
    where c.developer_id = p_developer and u.status = 'free'
      and case
        when p_public then private.is_public_complex(c.id) and exists (
          select 1 from private.layout_completeness lc where lc.layout_id = u.layout_id and lc.is_complete)
        else c.status <> 'archived'
      end
  ) as x
  where x.per_m2 > 0
  group by x.currency
  order by x.currency = 'USD' desc
  limit 1
$$;

create or replace function private.calc_complexes(p_developer uuid, p_public boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'blocks', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'currency', b.currency, 'layouts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.layout_id, 'rooms', o.rooms, 'area', o.area, 'price_from', o.price_from,
          'available', o.available
        ) order by o.rooms, o.area, o.sort), '[]'::jsonb)
        from (
          select * from private.site_layout_offers s where p_public and s.block_id = b.id
          union all
          select * from private.layout_offers a where not p_public and a.block_id = b.id
        ) o)
    ) order by b.sort, b.name), '[]'::jsonb)
    from public.blocks b
    where b.complex_id = c.id)
  ) order by c.sort, c.name), '[]'::jsonb)
  from public.complexes c
  where c.developer_id = p_developer
    and case
      when p_public then private.is_public_complex(c.id) and private.complex_site_view(c.id) = 'full'
      else c.status <> 'archived'
    end
$$;

-- ─── Сайт: фасад и план этажа ────────────────────────────────────────────────────────────
-- Квартира неполной планировки не раскрывает планировку, комнаты, площадь и цену. sellable — можно
-- выбрать: свободна, планировка полная, цена есть. Свободная с sellable = false на сайте серая.
drop function public.block_units(uuid);

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
  currency public.currency,
  sellable boolean
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
    case when c.is_complete then u.layout_id end,
    case when c.is_complete then l.rooms end,
    case when c.is_complete then l.area end,
    u.status,
    case when sale.sellable then coalesce(u.price, u.price_per_m2 * l.area) end,
    b.currency,
    sale.sellable
  from public.units u
  join public.blocks b on b.id = u.block_id
  left join public.layouts l on l.id = u.layout_id
  left join private.layout_completeness c on c.layout_id = u.layout_id
  cross join lateral (
    select coalesce(
      u.status = 'free' and c.is_complete and coalesce(u.price, u.price_per_m2 * l.area) > 0, false
    ) as sellable
  ) sale
  where u.block_id = target_block and private.can_see_complex(b.complex_id)
  order by u.entrance, u.floor desc, u.position
$$;

revoke all on function public.block_units(uuid) from public;
grant execute on function public.block_units(uuid) to anon, authenticated, service_role;

-- state блока: open — есть полные и список квартир; layouts — полные без списка («Смотреть
-- планировки»); soon — полных нет, блок серый и не кликается.
create or replace function public.site_complex_picker(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.can_see_complex(p_complex) then jsonb_build_object(
    'complex_id', p_complex,
    'facade', (
      select private.site_media(m) from public.media_assets m
      where m.complex_id = p_complex and m.kind = 'facade'),
    'blocks', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', b.id, 'contour', b.facade_contour,
        'state', case
          when not exists (
            select 1 from private.layout_completeness c where c.block_id = b.id and c.is_complete
          ) then 'soon'
          when exists (select 1 from public.units u where u.block_id = b.id) then 'open'
          else 'layouts'
        end)
        order by b.sort, b.name), '[]'::jsonb)
      from public.blocks b
      where b.complex_id = p_complex and b.facade_contour is not null),
    'plans', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'block_id', p.block_id, 'entrance', p.entrance,
        'floor_from', p.floor_from, 'floor_to', p.floor_to,
        'image', private.site_media(m), 'contours', p.contours)
        order by p.block_id, p.floor_from, p.entrance nulls first), '[]'::jsonb)
      from public.floor_plans p
      join public.media_assets m on m.id = p.image_id
      where p.complex_id = p_complex)
  ) end
$$;

-- Видео квартиры: снимок комнат и площади остаётся, расчёта у неполной планировки нет.
create or replace function public.site_unit_video(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.site_progress_report(r) || jsonb_build_object(
    'complex', (
      select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name,
        'developer', (select d.name from public.developers d where d.id = c.developer_id))
      from public.complexes c where c.id = r.complex_id),
    'layout_id', (
      select lc.layout_id from private.layout_completeness lc
      where lc.layout_id = r.layout_id and lc.is_complete),
    'rooms', r.unit_rooms,
    'area', r.unit_area,
    'floor', r.unit_floor,
    'history', (
      select coalesce(jsonb_agg(private.site_progress_report(h) order by h.month desc, h.created_at desc), '[]'::jsonb)
      from public.progress_reports h
      where h.id in (
        select x.id from public.progress_reports x
        where x.status = 'published' and x.id <> r.id
          and ((x.is_unit and r.unit_id is not null and x.unit_id = r.unit_id) or (not x.is_unit and x.block_id = r.block_id))
        order by x.month desc, x.created_at desc
        limit 6
      ))
  )
  from public.progress_reports r
  where r.id = p_id and r.status = 'published' and r.is_unit and private.can_see_complex(r.complex_id)
$$;

-- Наличие по всем планировкам — только кабинету: сайт читает site_catalog и site_complex, а эти
-- функции отдавали бы неполные планировки. Закрыты и от анонима, и от вошедшего без роли.
create or replace function public.layout_availability(target_complex uuid)
returns table (
  layout_id uuid,
  block_id uuid,
  rooms smallint,
  area numeric,
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
  where o.complex_id = target_complex and private.is_staff()
  order by o.block_sort, o.block_name, o.rooms, o.area, o.sort
$$;

create or replace function public.room_availability(complex_ids uuid[])
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
  where o.complex_id = any (complex_ids) and private.is_staff()
  group by o.complex_id, o.rooms, o.currency
  order by o.complex_id, o.rooms, o.currency
$$;

create or replace function public.block_availability(complex_ids uuid[])
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
  where b.complex_id = any (complex_ids) and private.is_staff()
  order by b.complex_id, b.sort, b.name
$$;

revoke execute on function
  public.layout_availability(uuid),
  public.room_availability(uuid[]),
  public.block_availability(uuid[])
from anon;

-- ─── Стражи: обязательное у опубликованного ЖК ───────────────────────────────────────────

-- Последняя программа, действующая на опубликованный ЖК. Проверяется после записи: так ловятся
-- выключение, удаление и смена блоков на любом пути; каскад удаления застройщика ЖК уже не видит.
create function private.guard_complex_program()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lost text;
begin
  if not old.is_active then
    return null;
  end if;
  select c.slug into lost
  from public.complexes c
  where c.developer_id = old.developer_id and c.status = 'published'
    and (old.blocks_scope = 'all' or exists (
      select 1 from public.blocks b where b.complex_id = c.id and b.id = any (old.block_ids)))
    and not exists (
      select 1 from public.payment_programs p
      where p.developer_id = c.developer_id and p.is_active
        and (p.blocks_scope = 'all' or exists (
          select 1 from public.blocks b where b.complex_id = c.id and b.id = any (p.block_ids))))
  limit 1;
  if lost is not null then
    raise exception 'Это последняя программа опубликованного ЖК — сначала нажмите «Скрыть» у ЖК'
      using errcode = 'check_violation', hint = 'vh:not_ready', detail = 'payment';
  end if;
  return null;
end;
$$;

revoke all on function private.guard_complex_program() from public;

create trigger payment_programs_guard_complex
  after update or delete on public.payment_programs
  for each row execute function private.guard_complex_program();

-- Застройщик с опубликованными ЖК не скрывается: ЖК иначе молча ушёл бы с сайта. Архив остаётся
-- сознательным действием с вводом названия и уносит ЖК каскадом.
create function private.guard_developer_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.complexes c where c.developer_id = new.id and c.status = 'published') then
    raise exception 'У застройщика есть опубликованные ЖК — сначала скройте их'
      using errcode = 'check_violation', hint = 'vh:developer_has_published';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_developer_hide() from public;

create trigger developers_guard_hide
  before update of status on public.developers
  for each row
  when (new.status = 'hidden' and old.status = 'published')
  execute function private.guard_developer_hide();

-- «Вернуть курс ЦБ» без курса ЦБ оставил бы опубликованные ЖК без записанного курса.
create or replace function public.set_manual_exchange_rate(p_rate numeric)
returns void
language plpgsql
set search_path = ''
as $$
declare
  manual jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Курс фиксирует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_rate is not null then
    perform private.check_exchange_rate(p_rate);
    manual := jsonb_build_object('usd_uzs', p_rate, 'date', (now() at time zone 'Asia/Tashkent')::date);
  elsif not exists (
    select 1 from public.settings s
    where s.key = 'exchange.usd_uzs' and jsonb_typeof(s.value -> 'cbu') = 'object'
  ) and exists (select 1 from public.complexes c where c.status = 'published') then
    raise exception 'Курса ЦБ нет, а на сайте есть опубликованные ЖК — ручной курс снять нельзя'
      using errcode = 'check_violation', hint = 'vh:rate_required';
  end if;
  insert into public.settings (key, value, is_public)
  values ('exchange.usd_uzs', jsonb_build_object('cbu', null, 'manual', coalesce(manual, 'null'::jsonb)), true)
  on conflict (key) do update
    set value = (public.settings.value - 'demo') || jsonb_build_object('manual', coalesce(manual, 'null'::jsonb));
end;
$$;

-- ─── Кабинет ─────────────────────────────────────────────────────────────────────────────

-- Тип фото меняет руководитель; обязательное у опубликованного ЖК не теряется.
create function public.set_complex_photo_category(p_media uuid, p_category text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
  before_change text[];
begin
  if not private.has_role('head') then
    raise exception 'Тип фото меняет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select m.complex_id into target from public.media_assets m where m.id = p_media and m.kind = 'photo';
  if target is null then
    raise exception 'Фото не найдено' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  before_change := private.complex_missing(target);
  update public.media_assets set photo_category = p_category where id = p_media;
  perform private.assert_complex_not_worse(target, before_change);
end;
$$;

-- Состояние ЖК для кабинета одним запросом: state, сколько пунктов минимума, сколько планировок
-- полны. draft — статус не «опубликован» или застройщик не на сайте.
create function public.complex_states()
returns table (
  complex_id uuid,
  state text,
  done integer,
  total integer,
  complete_layouts integer,
  layouts integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    case when private.is_public_complex(c.id) then private.complex_site_view(c.id) else 'draft' end,
    req.done,
    req.total,
    counts.complete_layouts,
    counts.layouts
  from public.complexes c
  cross join lateral (
    select (count(*) filter (where q.ok))::integer as done, count(*)::integer as total
    from private.complex_requirements(c.id) q
  ) req
  cross join lateral (
    select
      (count(*) filter (where lc.is_complete))::integer as complete_layouts,
      count(*)::integer as layouts
    from private.layout_completeness lc
    where lc.complex_id = c.id
  ) counts
  where private.has_role('head', 'manager')
$$;

-- Детали для карточки ЖК: что внутри составных пунктов и чего не хватает каждой планировке.
create function public.complex_completeness(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'state', case when private.is_public_complex(c.id) then private.complex_site_view(c.id) else 'draft' end,
    'requirements', (
      select coalesce(jsonb_agg(jsonb_build_object('requirement', q.requirement, 'ok', q.ok, 'have', q.have)), '[]'::jsonb)
      from private.complex_requirements(c.id) q),
    'cover_ok', coalesce((
      select m.photo_category = 'general' and greatest(m.width, m.height) >= 2400
      from public.media_assets m
      where m.complex_id = c.id and m.kind = 'photo'
      order by m.sort, m.created_at, m.id
      limit 1), false),
    'program_ok', exists (
      select 1 from public.payment_programs p
      where p.developer_id = c.developer_id and p.is_active
        and (p.blocks_scope = 'all' or exists (
          select 1 from public.blocks b where b.complex_id = c.id and b.id = any (p.block_ids)))),
    'rate_ok', private.exchange_rate() is not null,
    'layouts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', lc.layout_id, 'block_id', lc.block_id, 'complete', lc.is_complete,
        'missing', array_remove(array[
          case when not lc.has_price then 'price' end,
          case when not lc.has_drawing then 'drawing' end
        ], null))), '[]'::jsonb)
      from private.layout_completeness lc
      where lc.complex_id = c.id)
  )
  from public.complexes c
  where c.id = p_complex and private.has_role('head', 'manager')
$$;

revoke all on function
  public.set_complex_photo_category(uuid, text),
  public.complex_states(),
  public.complex_completeness(uuid)
from public, anon;
grant execute on function
  public.set_complex_photo_category(uuid, text),
  public.complex_states(),
  public.complex_completeness(uuid)
to authenticated;

-- Новый ЖК можно завести без застройщика.
create or replace function public.create_complex(p_developer uuid, p_name jsonb, p_slug text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  candidate text := p_slug;
  suffix integer := 1;
  developer_status public.publication_status;
  new_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'ЖК добавляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_developer is not null then
    select d.status into developer_status from public.developers d where d.id = p_developer;
    if developer_status is null then
      raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    if developer_status = 'archived' then
      raise exception 'Застройщик в архиве' using errcode = 'check_violation', hint = 'vh:developer_archived';
    end if;
  end if;
  if p_slug ~ '^demo(-|$)' then
    raise exception 'Адрес «demo-…» занят DEMO-данными' using errcode = 'check_violation', hint = 'vh:slug_reserved';
  end if;
  loop
    begin
      insert into public.complexes (developer_id, name, slug, sort)
      values (
        p_developer,
        p_name::public.i18n_text,
        candidate,
        (select coalesce(max(c.sort), 0) + 10 from public.complexes c)
      )
      returning id into new_id;
      return new_id;
    exception when unique_violation then
      suffix := suffix + 1;
      if suffix > 99 then
        raise;
      end if;
      candidate := p_slug || '-' || suffix;
    end;
  end loop;
end;
$$;

create or replace function public.complex_rows()
returns table (
  id uuid,
  slug text,
  name jsonb,
  status public.publication_status,
  archived_at timestamptz,
  developer_id uuid,
  developer_name text,
  developer_status public.publication_status,
  location_name text,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.status, c.archived_at, d.id, d.name, d.status, l.name ->> 'ru',
         c.updated_at
  from public.complexes c
  left join public.developers d on d.id = c.developer_id
  left join public.locations l on l.id = c.location_id
  where (select private.has_role('head', 'manager'))
  order by c.sort, c.name ->> 'ru'
$$;

-- Архив не меняется, только ЖК без застройщика тоже попадает в список на удаление.
create or replace function private.archive_items(p_from interval, p_to interval)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by item ->> 'archived_at'), '[]') from (
    select jsonb_build_object(
      'kind', 'complex', 'id', c.id, 'slug', c.slug, 'name', c.name, 'archived_at', c.archived_at,
      'purge_at', c.archived_at + interval '30 days',
      'complexes', jsonb_build_array(c.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m where m.complex_id = c.id)
    ) as item
    from public.complexes c
    left join public.developers d on d.id = c.developer_id
    where c.status = 'archived' and (d.id is null or d.status <> 'archived')
      and c.archived_at <= now() - p_from and c.archived_at > now() - p_to
    union all
    select jsonb_build_object(
      'kind', 'developer', 'id', d.id, 'slug', d.slug, 'name', d.name, 'archived_at', d.archived_at,
      'purge_at', d.archived_at + interval '30 days',
      'complexes', (select coalesce(jsonb_agg(c.id), '[]') from public.complexes c where c.developer_id = d.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m
                where m.developer_id = d.id
                   or m.complex_id in (select c.id from public.complexes c where c.developer_id = d.id)
                   or m.special_id in (select s.id from public.specials s where s.developer_id = d.id)
                   or m.ad_id in (select a.id from public.ads a where a.developer_id = d.id))
    )
    from public.developers d
    where d.status = 'archived' and d.archived_at <= now() - p_from and d.archived_at > now() - p_to
  ) as items;
$$;

-- ─── Уже опубликованные ──────────────────────────────────────────────────────────────────
-- Опубликованный ЖК без минимума возвращается в черновик: ничего не удаляется, руководитель
-- дозаполнит и опубликует снова с отметкой 1.2.
select set_config('vodiy.skip_audit', 'on', true);
update public.complexes c
set status = 'draft'
where c.status = 'published' and cardinality(private.complex_missing(c.id)) > 0;
select set_config('vodiy.skip_audit', 'off', true);
