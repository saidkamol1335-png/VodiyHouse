-- DEMO для стресс-теста шаблонов и нагрузки каталога (PLAN 3а, приёмка 3а):
-- «худший» ЖК (длинное название, без ориентира, 1 блок и 1 планировка), «лучший» (все поля, три
-- блока, планировки от студии до 5-комн.) и 30 ЖК для каталога при CPU ×4 (каждый пятый — в сумах, Ф6).
-- Идёт после seed.sql (`npm run demo:seed -- stress`): застройщики и справочники — оттуда.
-- Пометка DEMO — префикс «demo-» в slug; удаляет тот же remove.sql. Фото — scripts/demoMedia.mjs.

begin;

select set_config('vodiy.skip_audit', 'on', true);

-- ─── ЖК ──────────────────────────────────────────────────────────────────────────────────

create temporary table demo_stress_complex (
  slug text, developer text, name_ru text, name_uz text, class text, address_ru text, address_uz text,
  landmark_ru text, landmark_uz text, minutes int, lat numeric, lng numeric, sort int
) on commit drop;

insert into demo_stress_complex values
  ('demo-worst', 'demo-kamalak',
   -- Ровно 28 знаков (лимит названия под вёрстку) из длинных слов — проверка переносов.
   'Янги Фарғона Марказий Боғлар', 'Yangi Farg‘ona Markaziy Bog‘',
   'comfort', 'ул. Аль-Фаргани, 128, корпус 2, массив Кирзавод', 'Al-Farg‘oniy ko‘chasi, 128, 2-korpus, Kirzavod massivi',
   null, null, 25, 40.360100, 71.745800, 50),
  ('demo-best', 'demo-margilan-invest', 'Navro‘z Residence', 'Navro‘z Residence',
   'premium', 'ул. Ахунбабаева, 3', 'Oxunboboyev ko‘chasi, 3', 'у бульвара и набережной', 'xiyobon va sohil yonida',
   3, 40.385400, 71.788900, 51);

insert into demo_stress_complex
select
  format('demo-load-%s', lpad(n::text, 2, '0')),
  (array['demo-sifat', 'demo-margilan-invest', 'demo-kamalak'])[1 + n % 3],
  format('%s %s', name, (n - 1) / 10 + 1),
  format('%s %s', name, (n - 1) / 10 + 1),
  (array['comfort', 'business', 'premium'])[1 + n % 3],
  format('ул. Нагрузочная, %s', n), format('Sinov ko‘chasi, %s', n),
  'рядом с остановкой', 'bekat yonida',
  3 + n % 15, 40.370000 + (n % 10) * 0.002, 71.770000 + (n / 10) * 0.004, 100 + n
from generate_series(1, 30) as n
cross join lateral (
  select (array['Bahor', 'Gulzor', 'Nur', 'Lola', 'Do‘stlik', 'Mehr', 'Sayhun', 'Ipak', 'Tong', 'Chinor'])[1 + (n - 1) % 10] as name
) names;

insert into public.complexes (
  developer_id, slug, name, class, location_id, address, landmark, minutes_to_center,
  lat, lng, house_type, ceiling_height, parking,
  permit_checked_at, land_checked_at, staff_visited_at, status, sort
)
select
  d.id, c.slug, jsonb_build_object('ru', c.name_ru, 'uz', c.name_uz), c.class::public.complex_class, l.id,
  jsonb_build_object('ru', c.address_ru, 'uz', c.address_uz),
  case when c.landmark_ru is null then null else jsonb_build_object('ru', c.landmark_ru, 'uz', c.landmark_uz) end,
  c.minutes, c.lat, c.lng, 'monolith',
  case when c.slug = 'demo-worst' then null else 3.0 end,
  case when c.slug = 'demo-worst' then null else 'underground' end::public.parking_type,
  '2026-09-10', '2026-09-10', case when c.slug = 'demo-worst' then null else '2026-09-15'::date end,
  'published', c.sort
from demo_stress_complex c
join public.developers d on d.slug = c.developer
join public.locations l on l.slug = 'fergana';

-- ─── Блоки и планировки ──────────────────────────────────────────────────────────────────

create temporary table demo_stress_block (
  complex text, block text, entrances int, floors int, per_floor int, price_per_m2 numeric,
  currency text, status text, progress int, year int, quarter int, finishing text, sort int
) on commit drop;

insert into demo_stress_block values
  ('demo-worst', 'Д', 1, 5, 1, 640, 'USD', 'building', 15, 2028, 4, 'rough', 1),
  ('demo-best', 'A', 2, 14, 4, 1350, 'USD', 'delivered', 100, 2025, 2, 'turnkey', 1),
  ('demo-best', 'B', 2, 14, 4, 1290, 'USD', 'building', 70, 2027, 1, 'white-box', 2),
  ('demo-best', 'C', 1, 20, 3, 1450, 'USD', 'building', 25, 2028, 3, 'white-box', 3);

insert into demo_stress_block
select
  c.slug, '1', 1, 9 + n % 8, 3,
  case when n % 5 = 0 then 7500000 + (n % 4) * 500000 else 500 + (n * 37) % 600 end,
  case when n % 5 = 0 then 'UZS' else 'USD' end,
  case when n % 4 = 0 then 'delivered' else 'building' end,
  case when n % 4 = 0 then 100 else 10 + (n * 13) % 80 end,
  2026 + n % 3, 1 + n % 4, (array['rough', 'white-box'])[1 + n % 2], 1
from generate_series(1, 30) as n
join demo_stress_complex c on c.slug = format('demo-load-%s', lpad(n::text, 2, '0'));

insert into public.blocks (
  complex_id, name, build_status, progress_pct, floors_total, floors_built,
  deadline_year, deadline_quarter, finishing_id, cadastre, currency, sort
)
select
  c.id, b.block, b.status::public.build_status, b.progress, b.floors,
  case when b.status = 'delivered' then b.floors else greatest(1, b.floors * b.progress / 100) end,
  b.year, b.quarter, f.id,
  case when b.status = 'delivered' then 'done' else 'after_delivery' end::public.cadastre_status,
  b.currency::public.currency, b.sort
from demo_stress_block b
join public.complexes c on c.slug = b.complex
join public.finishings f on f.slug = b.finishing;

-- Позиция на этаже → планировка по порядку: у «худшего» одна, у «лучшего» — от студии до 5-комн.
create temporary table demo_stress_layout (complex text, block text, rooms int, area numeric, sort int) on commit drop;

insert into demo_stress_layout values
  ('demo-worst', 'Д', 2, 61.4, 1),
  ('demo-best', 'A', 0, 32.0, 1), ('demo-best', 'A', 1, 48.5, 2), ('demo-best', 'A', 2, 74.0, 3), ('demo-best', 'A', 3, 104.2, 4),
  ('demo-best', 'B', 1, 51.0, 1), ('demo-best', 'B', 2, 78.6, 2), ('demo-best', 'B', 3, 112.0, 3), ('demo-best', 'B', 4, 146.5, 4),
  ('demo-best', 'C', 2, 86.0, 1), ('demo-best', 'C', 4, 158.0, 2), ('demo-best', 'C', 5, 214.0, 3);

insert into demo_stress_layout
select b.complex, '1', l.rooms, l.area + (row_number() over ()) % 7, l.sort
from demo_stress_block b
cross join (values (1, 42.0, 1), (2, 63.0, 2), (3, 86.0, 3)) as l (rooms, area, sort)
where b.complex like 'demo-load-%';

insert into public.layouts (block_id, rooms, area, sort)
select bl.id, l.rooms, l.area, l.sort
from demo_stress_layout l
join public.complexes c on c.slug = l.complex
join public.blocks bl on bl.complex_id = c.id and bl.name = l.block;

-- ─── Квартиры: со второго этажа, позиция → планировка по кругу; статусы — по хешу номера ─

insert into public.units (block_id, layout_id, entrance, floor, "position", number, price, status)
select
  bl.id, l.id, e.n, f.n, p.n,
  row_number() over (partition by bl.id order by e.n, f.n, p.n)::text,
  case when b.currency = 'UZS'
    then round(l.area * b.price_per_m2 / 100000) * 100000
    else round(l.area * b.price_per_m2 * (1 + 0.006 * (f.n - 2)) / 10) * 10
  end,
  (array['free', 'free', 'free', 'reserved', 'sold', 'sold'])[1 + abs(hashtext(c.slug || bl.name || e.n || f.n || p.n)) % 6]::public.unit_status
from demo_stress_block b
join public.complexes c on c.slug = b.complex
join public.blocks bl on bl.complex_id = c.id and bl.name = b.block
cross join lateral generate_series(1, b.entrances) as e (n)
cross join lateral generate_series(2, b.floors) as f (n)
cross join lateral generate_series(1, b.per_floor) as p (n)
join lateral (
  select count(*) as total from demo_stress_layout x where x.complex = b.complex and x.block = b.block
) layouts on true
join public.layouts l on l.block_id = bl.id and l.sort = 1 + (p.n - 1) % layouts.total;

commit;
