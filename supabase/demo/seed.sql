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
  lat, lng, house_type, ceiling_height, parking, staff_visited_at, status, sort
)
select
  d.id, c.slug, jsonb_build_object('ru', c.name, 'uz', c.name), c.class::public.complex_class, l.id,
  jsonb_build_object('ru', c.address_ru, 'uz', c.address_uz),
  jsonb_build_object('ru', c.landmark_ru, 'uz', c.landmark_uz),
  c.minutes, c.lat, c.lng, 'monolith', c.ceiling, c.parking::public.parking_type,
  c.visited_on::date, 'published', c.sort
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

-- Документы ЖК (ТЗ 7.8, шаг 3.5): проверенные — с датой проверки (мокап: «6 проверено · 12.09.2026»);
-- акт ввода — у ЖК со сданным блоком. «Проверено Vodiy House» на карточке — разрешение и земля.
insert into public.complex_documents (complex_id, document_type_id, checked_on)
select c.id, t.id, x.checked_on::date
from (values
  ('demo-shodlik', '2026-09-12', true),
  ('demo-namuna', '2026-09-11', false),
  ('demo-yulduz', '2026-09-11', false),
  ('demo-orzu', '2026-09-09', true)
) as x (slug, checked_on, delivered)
join public.complexes c on c.slug = x.slug
join public.document_types t on t.slug <> 'commissioning' or x.delivered;

-- «Удобство локации» (Ф5): ближайшие места карты мокапа (JK_GEO) — метры по прямой, минуты пешком
-- по 75 м в минуту, как в мокапе.
update public.complexes c
set nearby = n.items::jsonb
from (values
  ('demo-shodlik', '[{"kind": "school", "name": {"ru": "Школа №46", "uz": "46-maktab"}, "meters": 270, "minutes": 4},
    {"kind": "kindergarten", "name": {"ru": "Детский сад №11", "uz": "11-bog‘cha"}, "meters": 210, "minutes": 3},
    {"kind": "mosque", "name": {"ru": "Мечеть «Кукча»", "uz": "«Ko‘kcha» masjidi"}, "meters": 470, "minutes": 6},
    {"kind": "clinic", "name": {"ru": "Семейная поликлиника №4", "uz": "4-oilaviy poliklinika"}, "meters": 680, "minutes": 9},
    {"kind": "shop", "name": {"ru": "Мини-маркет", "uz": "Minimarket"}, "meters": 60, "minutes": 1},
    {"kind": "stop", "name": {"ru": "маршруты 2, 9, 12", "uz": "2, 9, 12 yo‘nalishlar"}, "meters": 60, "minutes": 1}]'),
  ('demo-namuna', '[{"kind": "school", "name": {"ru": "Школа №14", "uz": "14-maktab"}, "meters": 370, "minutes": 5},
    {"kind": "kindergarten", "name": {"ru": "Детский сад №49", "uz": "49-bog‘cha"}, "meters": 360, "minutes": 5},
    {"kind": "mosque", "name": {"ru": "Мечеть «Сохил»", "uz": "«Sohil» masjidi"}, "meters": 250, "minutes": 3},
    {"kind": "clinic", "name": {"ru": "Семейная поликлиника №7", "uz": "7-oilaviy poliklinika"}, "meters": 760, "minutes": 10},
    {"kind": "shop", "name": {"ru": "Мини-маркет", "uz": "Minimarket"}, "meters": 180, "minutes": 2},
    {"kind": "stop", "name": {"ru": "маршруты 4, 7, 27", "uz": "4, 7, 27 yo‘nalishlar"}, "meters": 60, "minutes": 1}]'),
  ('demo-yulduz', '[{"kind": "school", "name": {"ru": "Школа №18", "uz": "18-maktab"}, "meters": 190, "minutes": 3},
    {"kind": "kindergarten", "name": {"ru": "Детский сад №12", "uz": "12-bog‘cha"}, "meters": 180, "minutes": 2},
    {"kind": "mosque", "name": {"ru": "Мечеть «Кукча»", "uz": "«Ko‘kcha» masjidi"}, "meters": 360, "minutes": 5},
    {"kind": "clinic", "name": {"ru": "Семейная поликлиника №7", "uz": "7-oilaviy poliklinika"}, "meters": 360, "minutes": 5},
    {"kind": "shop", "name": {"ru": "Мини-маркет", "uz": "Minimarket"}, "meters": 140, "minutes": 2},
    {"kind": "stop", "name": {"ru": "маршруты 21, 41, 45", "uz": "21, 41, 45 yo‘nalishlar"}, "meters": 60, "minutes": 1}]'),
  ('demo-orzu', '[{"kind": "school", "name": {"ru": "Школа №37", "uz": "37-maktab"}, "meters": 320, "minutes": 4},
    {"kind": "kindergarten", "name": {"ru": "Детский сад №36", "uz": "36-bog‘cha"}, "meters": 450, "minutes": 6},
    {"kind": "mosque", "name": {"ru": "Мечеть «Богишамол»", "uz": "«Bog‘ishamol» masjidi"}, "meters": 390, "minutes": 5},
    {"kind": "clinic", "name": {"ru": "Семейная поликлиника №2", "uz": "2-oilaviy poliklinika"}, "meters": 730, "minutes": 10},
    {"kind": "shop", "name": {"ru": "Мини-маркет", "uz": "Minimarket"}, "meters": 80, "minutes": 1},
    {"kind": "stop", "name": {"ru": "маршруты 15, 33, 45", "uz": "15, 33, 45 yo‘nalishlar"}, "meters": 130, "minutes": 2}]')
) as n (slug, items)
where c.slug = n.slug;

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

-- Перенос срока Shodlik B (мокап: «4 кв. 2027 · перенесён с 2 кв. 2027», ТЗ 7.3в).
insert into public.deadline_changes (complex_id, block_id, from_year, from_quarter, to_year, to_quarter, changed_on)
select c.id, b.id, 2027, 2, 2027, 4, '2026-08-20'
from public.complexes c
join public.blocks b on b.complex_id = c.id and b.name = 'B'
where c.slug = 'demo-shodlik';

-- Namuna показывает разделы сверх мокапа (Ф4): «Что входит в цену» и «Детали проекта» — тексты
-- DEMO; у Shodlik их нет — его страница совпадает с мокапом.
update public.blocks b
set price_includes = '[{"item": {"ru": "Отделка white box", "uz": "White box pardoz"}, "included": true},
  {"item": {"ru": "Остекление балкона", "uz": "Balkon oynasi"}, "included": true},
  {"item": {"ru": "Место в подземном паркинге", "uz": "Yer osti avtoturargohidagi joy"}, "included": false, "price": 9000},
  {"item": {"ru": "Кладовая", "uz": "Omborxona"}, "included": false, "price": 2500}]'
from public.complexes c
where c.id = b.complex_id and c.slug = 'demo-namuna';

insert into public.complex_details (complex_id, topic_id, text)
select c.id, t.id, jsonb_build_object('ru', x.ru, 'uz', x.uz)
from (values
  ('about',
   'Namuna — башня бизнес-класса в центре Ферганы, рядом с площадью Мустакиллик. 16 этажей, подземный паркинг и коммерческие помещения на первом этаже. Квартиры — от студий до 4-комнатных, отделка white box: остаётся выбрать покрытия и въезжать.',
   'Namuna — Farg‘ona markazida, Mustaqillik maydoni yonidagi biznes sinf minorasi. 16 qavat, yer osti avtoturargohi va birinchi qavatda tijorat binolari. Kvartiralar — studiyadan 4 xonaligacha, white box pardoz: qoplamalarni tanlab, ko‘chib kirish qoladi.'),
  ('quality',
   'Монолитный каркас, фасад из керамогранита, окна с двухкамерным стеклопакетом. В каждом подъезде — пассажирский и грузовой лифты.',
   'Monolit karkas, keramogranit fasad, ikki kamerali oynali derazalar. Har bir podyezdda — yo‘lovchi va yuk liftlari.'),
  ('landscaping',
   'Закрытый двор без машин: детская и спортивная площадки, места для отдыха, освещение и видеонаблюдение. Машины — в подземном паркинге.',
   'Mashinasiz yopiq hovli: bolalar va sport maydonchalari, dam olish joylari, yoritish va videokuzatuv. Mashinalar — yer osti avtoturargohida.')
) as x (topic, ru, uz)
join public.complexes c on c.slug = 'demo-namuna'
join public.detail_topics t on t.slug = x.topic;

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

-- ─── Витрина (3.16а): спецпредложения, реклама, подборки мокапа ─────────────────────────
-- Периоды — от дня сида в Ташкенте (private.tashkent_today(), как видимость на сайте): три
-- спецпредложения идут, «Старт продаж» ждёт своего дня; одна реклама идёт, вторая ждёт и
-- пересекается с первой (в кабинете — предупреждение, Г1 A). Своих фото нет — сайт берёт обложку
-- первого ЖК. Удаление — каскадом с DEMO-застройщиками, подборки — по «demo-».

insert into public.specials (developer_id, kind, badge, title, text, complex_ids, valid_from, valid_to, is_active, sort)
select
  d.id, s.kind::public.special_kind,
  jsonb_build_object('ru', s.badge_ru, 'uz', s.badge_uz),
  jsonb_build_object('ru', s.title_ru, 'uz', s.title_uz),
  jsonb_build_object('ru', s.text_ru, 'uz', s.text_uz),
  array(select c.id from public.complexes c where c.slug = any (s.complexes) order by array_position(s.complexes, c.slug)),
  private.tashkent_today() + s.from_days, private.tashkent_today() + s.to_days, true, s.sort
from (values
  ('demo-sifat', 'gift', 'Подарок', 'Sovg‘a',
   'Кухонный гарнитур в подарок', 'Oshxona mebeli sovg‘a',
   'При покупке квартиры в блоке B до конца месяца — кухонный гарнитур от застройщика.',
   'Oy oxirigacha B blokdan kvartira xarid qilganda — quruvchidan oshxona mebeli.',
   array['demo-shodlik'], -10, 20, 10),
  ('demo-margilan-invest', 'installment', 'Рассрочка 24 мес.', '24 oy muddatli',
   'Рассрочка на 24 месяца без наценки', '24 oyga ustama narxsiz muddatli to‘lov',
   'Первый взнос от 30%, остаток — равными частями до сдачи дома.',
   'Boshlang‘ich to‘lov 30% dan, qolgani — uy topshirilgunga qadar teng ulushlarda.',
   array['demo-namuna', 'demo-yulduz'], -3, 45, 20),
  ('demo-kamalak', 'bank', 'Через банк', 'Bank orqali',
   'Первый взнос от 20% через банк-партнёр', 'Hamkor bank orqali 20% dan boshlang‘ich to‘lov',
   'Оформление в офисе Vodiy House, решение банка — за два дня.',
   'Rasmiylashtirish Vodiy House ofisida, bank qarori — ikki kunda.',
   array['demo-orzu'], -1, 30, 30),
  ('demo-margilan-invest', 'sales_start', 'Старт продаж', 'Savdo boshlanishi',
   'Старт продаж второй очереди Yulduz', 'Yulduz ikkinchi navbati savdosi boshlanadi',
   'Стартовые цены на квартиры с видом на центр — первым покупателям.',
   'Markazga qaragan kvartiralarga boshlang‘ich narxlar — ilk xaridorlarga.',
   array['demo-yulduz'], 5, 40, 40)
) as s (developer, kind, badge_ru, badge_uz, title_ru, title_uz, text_ru, text_uz, complexes, from_days, to_days, sort)
join public.developers d on d.slug = s.developer;

insert into public.ads (developer_id, title, text, complex_ids, filter, valid_from, valid_to, is_active, sort)
select
  d.id,
  jsonb_build_object('ru', a.title_ru, 'uz', a.title_uz),
  jsonb_build_object('ru', a.text_ru, 'uz', a.text_uz),
  array(select c.id from public.complexes c where c.slug = any (a.complexes) order by array_position(a.complexes, c.slug)),
  a.filter::jsonb, private.tashkent_today() + a.from_days, private.tashkent_today() + a.to_days, true, a.sort
from (values
  ('demo-sifat',
   'Готовые 2-комнатные квартиры в рассрочку', 'Tayyor 2 xonali kvartiralar muddatli to‘lovga',
   'Сданные дома — можно въезжать сразу.', 'Topshirilgan uylar — darhol ko‘chib o‘tish mumkin.',
   array[]::text[], '{"komnat": "2", "srok": "built"}', -5, 25, 10),
  ('demo-kamalak',
   'Orzu: квартиры с отделкой white box', 'Orzu: white box pardozli kvartiralar',
   'Сдан первый блок, второй — в 2027 году.', 'Birinchi blok topshirildi, ikkinchisi — 2027 yilda.',
   array['demo-orzu'], '{}', 10, 40, 20)
) as a (developer, title_ru, title_uz, text_ru, text_uz, complexes, filter, from_days, to_days, sort)
join public.developers d on d.slug = a.developer;

-- Подборки мокапа (08.10.2026): четыре по фильтру, «Центр Ферганы» — вручную.
insert into public.collections (slug, title, mode, complex_ids, filter, sort, is_active)
select
  k.slug, jsonb_build_object('ru', k.title_ru, 'uz', k.title_uz), k.mode,
  array(select c.id from public.complexes c where c.slug = any (k.complexes) order by array_position(k.complexes, c.slug)),
  k.filter::jsonb, k.sort, true
from (values
  ('demo-sdannye-doma', 'Сданные дома', 'Topshirilgan uylar', 'filter', array[]::text[], '{"srok": "built"}', 10),
  ('demo-rassrochka-cherez-bank', 'Рассрочка через банк', 'Bank orqali muddatli to‘lov', 'filter', array[]::text[], '{"oplata": "bank"}', 20),
  ('demo-do-45000', 'До $45 000', '$45 000 gacha', 'filter', array[]::text[], '{"do": "45000"}', 30),
  ('demo-tsentr-fergany', 'Центр Ферганы', 'Farg‘ona markazi', 'manual', array['demo-namuna', 'demo-yulduz'], '{}', 40),
  ('demo-studii-i-1-komnatnye', 'Студии и 1-комнатные', 'Studiya va 1 xonali', 'filter', array[]::text[], '{"komnat": "0,1"}', 50)
) as k (slug, title_ru, title_uz, mode, complexes, filter, sort);

commit;
