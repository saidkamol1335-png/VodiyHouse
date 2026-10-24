-- DEMO-данные (PLAN §0.11, CLAUDE.md §8): вымышленные застройщики и ЖК из мокапа —
-- 3 застройщика, 4 ЖК (Shodlik, Namuna, Yulduz, Orzu), блоки, планировки, 506 квартир;
-- банки и программы оплаты мокапа, курс мокапа (фаза 2).
-- Пометка DEMO — префикс «demo-» в slug застройщика и ЖК. Удаление — `npm run demo:remove`,
-- повторный `npm run demo:seed` пересоздаёт DEMO с нуля. Фото DEMO — вместе со Storage (шаг 9).
-- Свободные квартиры по типам совпадают с «Остатками по ЖК» на главной кабинета в мокапе:
-- Shodlik 41 (Бл. A 12, Бл. B 29), Namuna 65, Yulduz 43, Orzu 27.

begin;

-- DEMO — не действия сотрудников: в журнал не пишется.
select set_config('vodiy.skip_audit', 'on', true);

-- ─── Застройщики (мокап: DEVS) ───────────────────────────────────────────────────────────

insert into public.developers (slug, name, about, founded_year, flats_delivered, delivered_checked_at, status, sort)
values
  ('demo-sifat', 'Farg‘ona Sifat Qurilish', jsonb_build_object(
    'ru', 'Строит жильё в Фергане и Маргилане с 2012 года. Основатели — инженеры-строители, начинали с ремонта и реконструкции. Ключевые проекты — Mehr в Маргилане и Shodlik у центрального парка Ферганы. Работает с монолитным каркасом и сдаёт дома с черновой отделкой или white box.',
    'uz', '2012 yildan beri Farg‘ona va Marg‘ilonda uy-joy quradi. Asoschilari — quruvchi muhandislar, faoliyatni ta’mirlash va rekonstruksiyadan boshlagan. Asosiy loyihalari — Marg‘ilondagi Mehr va Farg‘ona markaziy bog‘i yonidagi Shodlik. Monolit karkas bilan ishlaydi, uylarni qoralama pardoz yoki white box holatida topshiradi.'
  ), 2012, 2140, '2026-09-14', 'published', 1),
  ('demo-margilan-invest', 'Marg‘ilon Invest', jsonb_build_object(
    'ru', 'Девелопер бизнес- и премиум-класса. Основан в 2016 году предпринимателями из Маргилана. Строит башни с подземным паркингом и коммерческими помещениями на первых этажах. На сайте — Namuna и Yulduz в центре Ферганы.',
    'uz', 'Biznes va premium sinf developeri. 2016 yilda marg‘ilonlik tadbirkorlar tomonidan tashkil etilgan. Yer osti avtoturargohi va birinchi qavatlarida tijorat binolari bo‘lgan minoralar quradi. Saytda — Farg‘ona markazidagi Namuna va Yulduz.'
  ), 2016, 980, '2026-09-11', 'published', 2),
  ('demo-kamalak', 'Kamalak Development', jsonb_build_object(
    'ru', 'Молодая команда архитекторов и инженеров. С 2018 года строит дома комфорт-класса с продуманными дворами без машин. Проекты на сайте — Orzu в Фергане и Lola в Кувасае.',
    'uz', 'Arxitektor va muhandislardan iborat yosh jamoa. 2018 yildan beri mashinasiz hovlili komfort sinf uylarini quradi. Saytdagi loyihalari — Farg‘onadagi Orzu va Quvasoydagi Lola.'
  ), 2018, 760, '2026-09-09', 'published', 3);

-- Сданные объекты вне сайта: квартал плана и факта → последний день квартала.
insert into public.developer_past_projects (developer_id, name, planned_on, delivered_on, sort)
select d.id, jsonb_build_object('ru', p.name_ru, 'uz', p.name_uz), p.planned_on::date, p.delivered_on::date, p.sort
from (values
  ('demo-sifat', 'Дом на ул. Мустакиллик, 14', 'Mustaqillik ko‘chasi, 14-uy', '2021-06-30', '2021-06-30', 1),
  ('demo-sifat', 'ЖК Sifat City', 'Sifat City', '2022-12-31', '2023-03-31', 2),
  ('demo-margilan-invest', 'ЖК Ipak', 'Ipak', '2020-12-31', '2020-12-31', 1),
  ('demo-margilan-invest', 'ЖК Marg‘ilon Park', 'Marg‘ilon Park', '2023-06-30', '2023-06-30', 2),
  ('demo-kamalak', 'ЖК Kamalak', 'Kamalak', '2022-06-30', '2022-12-31', 1)
) as p (developer, name_ru, name_uz, planned_on, delivered_on, sort)
join public.developers d on d.slug = p.developer;

-- ─── ЖК (мокап: JKS) ─────────────────────────────────────────────────────────────────────
-- Точки — условные, в центре Ферганы (ЖК вымышленные); этажность ЖК считается по блокам.

insert into public.complexes (
  developer_id, slug, name, class, location_id, address, landmark, minutes_to_center,
  lat, lng, house_type, ceiling_height, parking,
  permit_checked_at, land_checked_at, staff_visited_at, status, sort
)
select
  d.id, c.slug, jsonb_build_object('ru', c.name, 'uz', c.name), c.class::public.complex_class, l.id,
  jsonb_build_object('ru', c.address_ru, 'uz', c.address_uz),
  jsonb_build_object('ru', c.landmark_ru, 'uz', c.landmark_uz),
  c.minutes, c.lat, c.lng, 'monolith', c.ceiling, c.parking::public.parking_type,
  c.checked_on::date, c.checked_on::date, c.visited_on::date, 'published', c.sort
from (values
  ('demo-sifat', 'demo-shodlik', 'Shodlik', 'comfort',
   'ул. Мустакиллик, 12', 'Mustaqillik ko‘chasi, 12', 'напротив центрального парка', 'markaziy bog‘ ro‘parasida',
   7, 40.384200, 71.784300, 3.0, 'underground', '2026-09-12', '2026-09-20', 1),
  ('demo-margilan-invest', 'demo-namuna', 'Namuna', 'business',
   'ул. Навои, 45', 'Navoiy ko‘chasi, 45', 'рядом с площадью Мустакиллик', 'Mustaqillik maydoni yonida',
   4, 40.388900, 71.783100, 3.1, 'underground', '2026-09-11', '2026-09-18', 2),
  ('demo-margilan-invest', 'demo-yulduz', 'Yulduz', 'premium',
   'ул. Сайилгох, 9', 'Sayilgoh ko‘chasi, 9', 'в центре, у пешеходной улицы', 'markazda, piyodalar ko‘chasi yonida',
   2, 40.387100, 71.790500, 3.3, 'underground', '2026-09-11', '2026-09-21', 3),
  ('demo-kamalak', 'demo-orzu', 'Orzu', 'comfort',
   'ул. Маргилонская, 77', 'Marg‘ilon ko‘chasi, 77', 'рядом с университетом', 'universitet yonida',
   12, 40.376800, 71.775200, 3.0, 'mixed', '2026-09-09', '2026-09-19', 4)
) as c (developer, slug, name, class, address_ru, address_uz, landmark_ru, landmark_uz,
        minutes, lat, lng, ceiling, parking, checked_on, visited_on, sort)
join public.developers d on d.slug = c.developer
join public.locations l on l.slug = 'fergana';

-- ─── Блоки: параметры генератора и цена за м² (мокап: blocks, ppm) ───────────────────────

create temporary table demo_block_plan (
  complex text, block text, entrances int, floors int, first_floor int, per_floor int, price_per_m2 int
) on commit drop;

insert into demo_block_plan values
  ('demo-shodlik', 'A', 2, 12, 2, 4, 700),
  ('demo-shodlik', 'B', 2, 12, 2, 4, 700),
  ('demo-namuna', '1', 2, 16, 2, 4, 980),
  ('demo-yulduz', '1', 2, 18, 2, 3, 1250),
  ('demo-orzu', '1', 2, 10, 2, 3, 760),
  ('demo-orzu', '2', 2, 10, 2, 3, 760);

insert into public.blocks (
  complex_id, name, build_status, progress_pct, floors_total, floors_built,
  deadline_year, deadline_quarter, finishing_id, cadastre, currency, sort
)
select
  c.id, b.block, b.status::public.build_status, b.progress, b.floors_total, b.floors_built,
  b.year, b.quarter, f.id, b.cadastre::public.cadastre_status, 'USD', b.sort
from (values
  ('demo-shodlik', 'A', 'delivered', 100, 12, 12, 2025, 3, 'rough', 'done', 1),
  ('demo-shodlik', 'B', 'building', 58, 12, 7, 2027, 4, 'white-box', 'after_delivery', 2),
  ('demo-namuna', '1', 'building', 40, 16, 6, 2028, 2, 'white-box', 'after_delivery', 1),
  ('demo-yulduz', '1', 'building', 50, 18, 9, 2027, 3, 'white-box', 'after_delivery', 1),
  ('demo-orzu', '1', 'delivered', 100, 10, 10, 2025, 4, 'white-box', 'done', 1),
  ('demo-orzu', '2', 'building', 80, 10, 9, 2027, 1, 'white-box', 'in_progress', 2)
) as b (complex, block, status, progress, floors_total, floors_built, year, quarter, finishing, cadastre, sort)
join public.complexes c on c.slug = b.complex
join public.finishings f on f.slug = b.finishing;

-- ─── Планировки (мокап: plans) ───────────────────────────────────────────────────────────

insert into public.layouts (block_id, rooms, area, sort)
select bl.id, l.rooms, l.area, l.sort
from (values
  ('demo-shodlik', 'A', 1, 42.5, 1), ('demo-shodlik', 'A', 1, 46.8, 2),
  ('demo-shodlik', 'A', 2, 67.1, 3), ('demo-shodlik', 'A', 3, 78.0, 4),
  ('demo-shodlik', 'B', 1, 44.1, 1), ('demo-shodlik', 'B', 2, 58.7, 2),
  ('demo-shodlik', 'B', 2, 64.2, 3), ('demo-shodlik', 'B', 3, 84.3, 4),
  ('demo-namuna', '1', 0, 34.2, 1), ('demo-namuna', '1', 1, 48.6, 2), ('demo-namuna', '1', 1, 52.4, 3),
  ('demo-namuna', '1', 2, 71.3, 4), ('demo-namuna', '1', 2, 76.8, 5), ('demo-namuna', '1', 3, 98.5, 6),
  ('demo-namuna', '1', 4, 132.0, 7),
  ('demo-yulduz', '1', 1, 56.0, 1), ('demo-yulduz', '1', 2, 82.4, 2),
  ('demo-yulduz', '1', 3, 118.6, 3), ('demo-yulduz', '1', 4, 156.0, 4),
  ('demo-orzu', '1', 1, 44.6, 1), ('demo-orzu', '1', 2, 63.2, 2), ('demo-orzu', '1', 3, 88.0, 3),
  ('demo-orzu', '2', 0, 30.5, 1), ('demo-orzu', '2', 1, 45.2, 2),
  ('demo-orzu', '2', 2, 64.0, 3), ('demo-orzu', '2', 3, 89.4, 4)
) as l (complex, block, rooms, area, sort)
join public.complexes c on c.slug = l.complex
join public.blocks bl on bl.complex_id = c.id and bl.name = l.block;

-- ─── Стояки: позиция → планировка (номер по порядку в блоке) на диапазон этажей ──────────
-- Стояк подъезда (entrance) уточняет общий — как в lib/units/risers.ts.

create temporary table demo_risers (
  complex text, block text, entrance int, position int, floor_from int, floor_to int, layout_sort int
) on commit drop;

insert into demo_risers values
  ('demo-shodlik', 'A', null, 1, 2, 12, 1), ('demo-shodlik', 'A', null, 2, 2, 12, 2),
  ('demo-shodlik', 'A', null, 3, 2, 12, 3), ('demo-shodlik', 'A', null, 4, 2, 12, 4),
  ('demo-shodlik', 'B', null, 1, 2, 12, 1), ('demo-shodlik', 'B', null, 2, 2, 12, 2),
  ('demo-shodlik', 'B', null, 3, 2, 12, 3), ('demo-shodlik', 'B', null, 4, 2, 12, 4),
  ('demo-namuna', '1', null, 1, 2, 16, 1),
  ('demo-namuna', '1', 1, 2, 2, 16, 2), ('demo-namuna', '1', 2, 2, 2, 16, 3),
  ('demo-namuna', '1', 1, 3, 2, 16, 4), ('demo-namuna', '1', 2, 3, 2, 16, 5),
  ('demo-namuna', '1', null, 4, 2, 14, 6), ('demo-namuna', '1', null, 4, 15, 16, 7),
  ('demo-yulduz', '1', null, 1, 2, 18, 1), ('demo-yulduz', '1', null, 2, 2, 18, 2),
  ('demo-yulduz', '1', null, 3, 2, 16, 3), ('demo-yulduz', '1', null, 3, 17, 18, 4),
  ('demo-orzu', '1', null, 1, 2, 10, 1), ('demo-orzu', '1', null, 2, 2, 10, 2),
  ('demo-orzu', '1', null, 3, 2, 10, 3),
  ('demo-orzu', '2', 1, 1, 2, 10, 1), ('demo-orzu', '2', 2, 1, 2, 10, 2),
  ('demo-orzu', '2', null, 2, 2, 10, 3), ('demo-orzu', '2', null, 3, 2, 10, 4);

-- ─── Квартиры: как генератор (lib/units/blockPlan.ts) — сквозная нумерация ───────────────
-- Цена — формула мокапа: площадь × цена м² × (1 + 0,6 % за этаж выше второго, −2 % на втором),
-- до $10.

insert into public.units (block_id, layout_id, entrance, floor, "position", number, price)
select
  bl.id,
  l.id,
  e.n,
  f.n,
  p.n,
  row_number() over (partition by bl.id order by e.n, f.n, p.n)::text,
  round(l.area * plan.price_per_m2 * (1 + 0.006 * (f.n - 2) - case when f.n = 2 then 0.02 else 0 end) / 10) * 10
from demo_block_plan plan
join public.complexes c on c.slug = plan.complex
join public.blocks bl on bl.complex_id = c.id and bl.name = plan.block
cross join lateral generate_series(1, plan.entrances) as e (n)
cross join lateral generate_series(plan.first_floor, plan.floors) as f (n)
cross join lateral generate_series(1, plan.per_floor) as p (n)
cross join lateral (
  select r.layout_sort
  from demo_risers r
  where r.complex = plan.complex and r.block = plan.block and r.position = p.n
    and f.n between r.floor_from and r.floor_to
    and (r.entrance is null or r.entrance = e.n)
  order by r.entrance nulls last
  limit 1
) riser
join public.layouts l on l.block_id = bl.id and l.sort = riser.layout_sort;

-- ─── Статусы: свободных — ровно как в «Остатках по ЖК» мокапа, следом 2 брони, дальше продано ─

create temporary table demo_free (complex text, block text, rooms int, free int) on commit drop;

insert into demo_free values
  ('demo-shodlik', 'A', 1, 4), ('demo-shodlik', 'A', 2, 6), ('demo-shodlik', 'A', 3, 2),
  ('demo-shodlik', 'B', 1, 10), ('demo-shodlik', 'B', 2, 16), ('demo-shodlik', 'B', 3, 3),
  ('demo-namuna', '1', 0, 13), ('demo-namuna', '1', 1, 18), ('demo-namuna', '1', 2, 18),
  ('demo-namuna', '1', 3, 13), ('demo-namuna', '1', 4, 3),
  ('demo-yulduz', '1', 1, 15), ('demo-yulduz', '1', 2, 15), ('demo-yulduz', '1', 3, 12),
  ('demo-yulduz', '1', 4, 1),
  ('demo-orzu', '1', 1, 2), ('demo-orzu', '1', 2, 1), ('demo-orzu', '1', 3, 2),
  ('demo-orzu', '2', 0, 7), ('demo-orzu', '2', 1, 8), ('demo-orzu', '2', 2, 2), ('demo-orzu', '2', 3, 5);

-- Порядок внутри типа — по хешу номера: свободные разбросаны по этажам, а не идут подряд.
with ranked as (
  select
    u.id,
    t.free,
    row_number() over (partition by u.block_id, l.rooms order by md5(c.slug || bl.name || u.number)) as place
  from public.units u
  join public.layouts l on l.id = u.layout_id
  join public.blocks bl on bl.id = u.block_id
  join public.complexes c on c.id = bl.complex_id
  join demo_free t on t.complex = c.slug and t.block = bl.name and t.rooms = l.rooms
)
update public.units u
set status = case
  when r.place <= r.free then 'free'
  when r.place <= r.free + 2 then 'reserved'
  else 'sold'
end::public.unit_status
from ranked r
where r.id = u.id;

-- ─── Банки и программы оплаты (мокап: BANKS, PROGS; фаза 2) ─────────────────────────────
-- Названия банков настоящие, условия — вымышленные (DEMO). Кнопки сроков — по PLAN (без 18 мес.
-- мокапа: такой срок — «свой»), минимальный срок ступени — 1 мес. Ипотека Sifat — только Shodlik A
-- (Mehr из мокапа в DEMO нет), схема Kamalak — только Orzu 2.

insert into public.banks (slug, name, sort) values
  ('demo-ipoteka', '{"ru": "Ipoteka Bank", "uz": "Ipoteka Bank"}', 10),
  ('demo-ipak-yuli', '{"ru": "Ipak Yuli Bank", "uz": "Ipak Yuli Bank"}', 20);

insert into public.payment_programs (
  developer_id, bank_id, type, method, discount_pct, min_down_pct, tiers, terms, fees,
  preset_months, allow_custom_months, currency, blocks_scope, block_ids, is_active, sort
)
select
  d.id, b.id, p.type::public.payment_program_type, p.method::public.payment_method, p.discount,
  p.min_down, p.tiers::jsonb, p.terms::jsonb, p.fees::jsonb, p.presets::smallint[], p.custom,
  p.currency::public.currency, p.scope::public.program_blocks_scope,
  coalesce((
    select array_agg(bl.id order by bl.id)
    from public.blocks bl
    join public.complexes c on c.id = bl.complex_id
    where c.slug || ':' || bl.name = any (p.blocks::text[])
  ), '{}'),
  true, p.sort
from (values
  ('demo-sifat', null, 'full', null, 12, null, '[]', '[]', '[]', '{}', false, null, 'all', '{}', 10),
  ('demo-sifat', null, 'installment', 'tiers', null, null,
   '[{"min_down_pct": 30, "discount_pct": 0, "min_months": 1, "max_months": 36},
     {"min_down_pct": 50, "discount_pct": 6, "min_months": 1, "max_months": 18},
     {"min_down_pct": 70, "discount_pct": 9, "min_months": 1, "max_months": 12}]',
   '[]', '[]', '{12,24,36,48}', true, null, 'all', '{}', 20),
  ('demo-sifat', 'demo-ipoteka', 'bank_installment', 'annuity', null, 20, '[]',
   '[{"months": 12, "rate_pct": 16}, {"months": 24, "rate_pct": 18}]',
   '[{"name": "appraisal", "kind": "fixed", "value": 1500000}, {"name": "commission", "kind": "pct", "value": 1}]',
   '{}', false, 'UZS', 'all', '{}', 30),
  ('demo-sifat', 'demo-ipoteka', 'mortgage', 'annuity', null, 25, '[]',
   '[{"months": 60, "rate_pct": 17.5}, {"months": 120, "rate_pct": 17.5}, {"months": 180, "rate_pct": 17.5}]',
   '[{"name": "appraisal", "kind": "fixed", "value": 1500000}, {"name": "insurance", "kind": "pct", "value": 0.5}]',
   '{}', false, 'UZS', 'selected', '{demo-shodlik:A}', 40),
  ('demo-margilan-invest', null, 'full', null, 10, null, '[]', '[]', '[]', '{}', false, null, 'all', '{}', 10),
  ('demo-margilan-invest', null, 'installment', 'tiers', null, null,
   '[{"min_down_pct": 40, "discount_pct": 0, "min_months": 1, "max_months": 36},
     {"min_down_pct": 60, "discount_pct": 5, "min_months": 1, "max_months": 24},
     {"min_down_pct": 80, "discount_pct": 8, "min_months": 1, "max_months": 12}]',
   '[]', '[]', '{12,24,36,48}', true, null, 'all', '{}', 20),
  ('demo-margilan-invest', 'demo-ipak-yuli', 'bank_installment', 'differentiated', null, 25, '[]',
   '[{"months": 12, "rate_pct": 15}, {"months": 24, "rate_pct": 16}, {"months": 36, "rate_pct": 17}]',
   '[{"name": "commission", "kind": "pct", "value": 1}]',
   '{}', false, 'UZS', 'all', '{}', 30),
  ('demo-margilan-invest', 'demo-ipak-yuli', 'mortgage', 'annuity', null, 20, '[]',
   '[{"months": 120, "rate_pct": 18}, {"months": 180, "rate_pct": 18}, {"months": 240, "rate_pct": 18}]',
   '[{"name": "appraisal", "kind": "fixed", "value": 1200000}]',
   '{}', false, 'UZS', 'all', '{}', 40),
  ('demo-kamalak', null, 'full', null, 9, null, '[]', '[]', '[]', '{}', false, null, 'all', '{}', 10),
  ('demo-kamalak', null, 'installment', 'tiers', null, null,
   '[{"min_down_pct": 30, "discount_pct": 0, "min_months": 1, "max_months": 18},
     {"min_down_pct": 50, "discount_pct": 5, "min_months": 1, "max_months": 12}]',
   '[]', '[]', '{12,24,36,48}', true, null, 'selected', '{demo-orzu:2}', 20),
  ('demo-kamalak', 'demo-ipak-yuli', 'bank_installment', 'annuity', null, 30, '[]',
   '[{"months": 24, "rate_pct": 16}]',
   '[{"name": "commission", "kind": "pct", "value": 1}]',
   '{}', false, 'UZS', 'all', '{}', 30)
) as p (developer, bank, type, method, discount, min_down, tiers, terms, fees, presets, custom,
        currency, scope, blocks, sort)
join public.developers d on d.slug = p.developer
left join public.banks b on b.slug = p.bank;

-- Курс мокапа на 01.10.2026 (с ним сходятся все числа экранов). Пометка demo: настоящий курс ЦБ
-- её снимает, demo:remove удаляет только помеченный; настоящий курс не трогаем.
insert into public.settings (key, value, is_public)
values (
  'exchange.usd_uzs',
  '{"cbu": {"usd_uzs": 11808.76, "date": "2026-10-01"}, "manual": null, "demo": true}',
  true
)
on conflict (key) do nothing;

commit;
