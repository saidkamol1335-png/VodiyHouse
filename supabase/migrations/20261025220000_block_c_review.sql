-- Ревью блока C (страница ЖК, вкладки кабинета, мастер, предпросмотр), исправления базы:
-- 1. «Сегодня» — по Ташкенту: дата проверки документа и дата записи переноса срока (база в UTC —
--    с 00:00 до 05:00 по Ташкенту сегодняшняя дата получала отказ, а перенос — вчерашнее число).
-- 2. Предпросмотр (draftMode) — только руководителю, как маршрут /api/predprosmotr: видеограф
--    не получает черновики и программы чужого застройщика через security definer.
-- 3. Предпросмотр черновика — как будущая страница: программы «выбранных блоков» видят блоки этого
--    ЖК, «Рассчитать платёж» считает и черновик; посетителю — по-прежнему только сайт.
-- 4. on_site — увидит ли страницу посетитель (ЖК и застройщик опубликованы): пометка предпросмотра.
-- 5. «Наличие обновлено» — по квартирам и планировкам, без правок блоков (кадастр, название).
-- 6. Порядок каталога: неопубликованные — за последним опубликованным (вернувшийся из скрытых или
--    опубликованный черновик встаёт в конец, а не делит место); устаревший список — свой отказ.

alter table public.deadline_changes
  alter column changed_on set default (now() at time zone 'Asia/Tashkent')::date;

create or replace function public.save_complex_documents(p_complex uuid, p_documents jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Документы ЖК правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents) > 30 then
    raise exception 'Нужен список до 30 документов' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  -- case, а не or: приведение к smallint — только после проверки, что это число.
  if exists (
    select 1 from jsonb_array_elements(p_documents) as item
    where case
      when not private.json_number_between(item -> 'type_id', 1, 32767, true) then true
      when nullif(item ->> 'checked_on', '') is null then true
      else not exists (select 1 from public.document_types t where t.id = (item ->> 'type_id')::smallint)
    end
  ) or (
    select count(distinct item ->> 'type_id') <> count(*) from jsonb_array_elements(p_documents) as item
  ) then
    raise exception 'Документ не найден или указан дважды — обновите страницу'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_documents) as item
    where (item ->> 'checked_on')::date > (now() at time zone 'Asia/Tashkent')::date
  ) then
    raise exception 'Дата проверки — не позже сегодняшней'
      using errcode = 'check_violation', hint = 'vh:future_date';
  end if;

  delete from public.complex_documents d
  where d.complex_id = p_complex
    and d.document_type_id not in (
      select (item ->> 'type_id')::smallint from jsonb_array_elements(p_documents) as item
    );
  insert into public.complex_documents (complex_id, document_type_id, checked_on)
  select p_complex, (item ->> 'type_id')::smallint, (item ->> 'checked_on')::date
  from jsonb_array_elements(p_documents) as item
  on conflict (complex_id, document_type_id) do update
    set checked_on = excluded.checked_on
    where public.complex_documents.checked_on is distinct from excluded.checked_on;
end;
$$;

-- Программа на странице ЖК: block_ids — блоки на сайте и блоки этого ЖК (у черновика в
-- предпросмотре — его собственные). Посетитель получает только опубликованный ЖК, лишнего нет.
create function private.page_program(p public.payment_programs, p_checked_at timestamptz, p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.site_program(p, p_checked_at) || jsonb_build_object('block_ids', (
    select coalesce(jsonb_agg(b.id order by b.id), '[]'::jsonb)
    from public.blocks b
    where b.id = any (p.block_ids)
      and (b.complex_id = p_complex or private.is_public_complex(b.complex_id))))
$$;

create function private.complex_page_developer(p_developer uuid, p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'slug', d.slug, 'name', d.name, 'about', d.about, 'founded_year', d.founded_year,
    'delivered_checked_at', d.delivered_checked_at,
    'logo', (select private.site_media(m) from public.media_assets m
             where m.developer_id = d.id and m.kind = 'logo'),
    'complexes_built', (
      select count(*) from public.complexes c
      where c.developer_id = d.id and private.is_public_complex(c.id)
        and exists (select 1 from public.blocks b where b.complex_id = c.id)
        and not exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status <> 'delivered')),
    'complexes_building', (
      select count(*) from public.complexes c
      where c.developer_id = d.id and private.is_public_complex(c.id)
        and exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status <> 'delivered')),
    'programs', (
      select coalesce(jsonb_agg(private.page_program(p, d.programs_checked_at, p_complex)
        order by p.sort, p.created_at), '[]'::jsonb)
      from public.payment_programs p
      where p.developer_id = d.id and p.is_active
        and (p.blocks_scope = 'all' or exists (
          select 1 from public.blocks b
          where b.id = any (p.block_ids)
            and (b.complex_id = p_complex or private.is_public_complex(b.complex_id))))))
  from public.developers d
  where d.id = p_developer
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

comment on function public.site_complex(text) is
  'Страница ЖК (шаг 3.5): ЖК, застройщик с программами без скидок, фото, блоки с наличием и историей сроков, планировки, документы, видео, детали, другие ЖК застройщика. Черновик — только руководителю (предпросмотр, шаг 3.6).';

drop function private.complex_page_developer(uuid);

-- «Расчёт для этой квартиры»: как в 20261024180000, плюс черновик — руководителю в предпросмотре
-- (кабинет зовёт её сессией руководителя мимо кэша сайта), программы — по блокам этого ЖК.
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
      where u.layout_id = o.layout_id and u.status = 'free'),
    'programs', (
      select coalesce(jsonb_agg(private.page_program(p, d.programs_checked_at, c.id)
        order by p.sort, p.created_at), '[]'::jsonb)
      from public.payment_programs p
      where p.developer_id = d.id and p.is_active
        and (p.blocks_scope = 'all' or b.id = any (p.block_ids)))
  )
  from private.layout_offers o
  join public.blocks b on b.id = o.block_id
  join public.complexes c on c.id = b.complex_id
  join public.developers d on d.id = c.developer_id
  join public.layouts l on l.id = o.layout_id
  left join public.media_assets m on m.id = l.drawing_id
  where o.layout_id = p_layout
    and (private.is_public_complex(c.id) or private.has_role('head'))
    and o.available and o.price_from > 0
$$;

create or replace function public.reorder_complexes(p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Порядок каталога меняет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if cardinality(p_ids) is distinct from (
       select count(*) from public.complexes c where c.status = 'published')
     or exists (
       select 1 from unnest(p_ids) as x (id)
       where not exists (select 1 from public.complexes c where c.id = x.id and c.status = 'published')
     )
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'Список ЖК изменился — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:stale_list';
  end if;
  update public.complexes c set sort = x.ord * 10
    from unnest(p_ids) with ordinality as x (id, ord)
    where c.id = x.id and c.sort is distinct from (x.ord * 10)::integer;
  -- Остальные — за последним опубликованным, в прежнем порядке.
  update public.complexes c set sort = (cardinality(p_ids) + rest.ord) * 10
    from (
      select r.id, row_number() over (order by r.sort, r.created_at, r.id) as ord
      from public.complexes r where r.status <> 'published'
    ) as rest
    where c.id = rest.id and c.sort is distinct from ((cardinality(p_ids) + rest.ord) * 10)::integer;
end;
$$;

revoke all on function
  private.page_program(public.payment_programs, timestamptz, uuid),
  private.complex_page_developer(uuid, uuid)
from public;
