-- DEMO для правила публикации v2 (docs/publication-rule.md): отдельный файл, чтобы цифры основного сида
-- и «Остатки» мокапа не менялись. Удаляется вместе с остальным DEMO (remove.sql, slug «demo-…»).
-- demo-skoro — минимум есть, полных планировок нет: состояние «Скоро». demo-seryy — полный ЖК: первая
-- планировка блока 1 с чертежом (scripts/demoMedia.mjs), вторая без чертежа; у блока 2 полных нет.
-- demo-chernovik — черновик без рендеров: на сайте его нет.

begin;

select set_config('vodiy.skip_audit', 'on', true);

insert into public.complexes (
  developer_id, slug, name, location_id, address, lat, lng, house_type, status, sort
)
select
  d.id, c.slug, jsonb_build_object('ru', c.name, 'uz', c.name),
  (select l.id from public.locations l order by l.sort limit 1),
  jsonb_build_object('ru', c.address_ru, 'uz', c.address_uz),
  c.lat, c.lng, 'monolith', c.status::public.publication_status, c.sort
from (values
  ('demo-sifat', 'demo-skoro', 'Skoro', 'ул. Навои, 3 (DEMO)', 'Navoiy ko‘chasi, 3 (DEMO)', 40.3851, 71.7901, 'published', 90),
  ('demo-kamalak', 'demo-seryy', 'Seryy', 'ул. Навои, 5 (DEMO)', 'Navoiy ko‘chasi, 5 (DEMO)', 40.3861, 71.7911, 'published', 91),
  ('demo-sifat', 'demo-chernovik', 'Chernovik', 'ул. Навои, 7 (DEMO)', 'Navoiy ko‘chasi, 7 (DEMO)', 40.3871, 71.7921, 'draft', 92)
) as c (developer, slug, name, address_ru, address_uz, lat, lng, status, sort)
join public.developers d on d.slug = c.developer;

insert into public.blocks (
  complex_id, name, build_status, floors_total, deadline_year, deadline_quarter, currency, sort
)
select c.id, b.block, 'building', 12, 2028, 2, 'USD', b.sort
from (values
  ('demo-skoro', '1', 1),
  ('demo-seryy', '1', 1),
  ('demo-seryy', '2', 2),
  ('demo-chernovik', '1', 1)
) as b (complex, block, sort)
join public.complexes c on c.slug = b.complex;

insert into public.layouts (block_id, rooms, area, sort)
select bl.id, l.rooms, l.area, l.sort
from (values
  ('demo-skoro', '1', 1, 42.0, 1),
  ('demo-seryy', '1', 1, 42.5, 1),
  ('demo-seryy', '1', 2, 64.5, 2),
  ('demo-seryy', '2', 3, 78.0, 1)
) as l (complex, block, rooms, area, sort)
join public.complexes c on c.slug = l.complex
join public.blocks bl on bl.complex_id = c.id and bl.name = l.block;

-- Блок 1: этажи 2–3, по 4 квартиры. Позиции 1–2 — планировка с чертежом, 3–4 — без чертежа.
-- Блок 2: свободные квартиры единственной планировки без чертежа — блок серый.
insert into public.units (block_id, layout_id, entrance, floor, "position", number, price, status)
select bl.id, la.id, 1, f.n, p.n, ((f.n - 2) * 4 + p.n)::text, 40000 + p.n * 1000,
  case when f.n = 3 and p.n = 2 then 'sold' else 'free' end::public.unit_status
from public.complexes c
join public.blocks bl on bl.complex_id = c.id
cross join generate_series(2, 3) as f (n)
cross join generate_series(1, 4) as p (n)
join public.layouts la on la.block_id = bl.id
  and la.sort = case when bl.name = '1' and p.n > 2 then 2 else 1 end
where c.slug = 'demo-seryy';

commit;
