-- Фаза 2 · 2.9б: функции калькуляторов, которые дописывались в 20261024100000_payment_programs.sql
-- уже после её применения в облаке (шаги 2.6–2.7 и ревью 2.5–2.7): облако применило версию файла
-- из коммита 5a364df и новых функций не получило — /kalkulyator там отвечал «заработает, когда…»,
-- а сайт получал «Условия для клиента». Файл 20261024100000 возвращён к применённой версии, всё
-- дописанное после неё — здесь, дословно (сверка схем облака и PGlite — 0 расхождений).

-- Цена м² по умолчанию — и для сайта (p_public): новая сигнатура вместо (uuid), иначе вызов с одним
-- аргументом стал бы неоднозначным.
drop function private.developer_price_hint(uuid);

-- «Пример: 60 м² × $620 …» на карточке и цена м² по умолчанию в расчёте (Р8): минимальная цена м²
-- свободных квартир застройщика; блоки в обеих валютах — в долларах. Кабинет — ЖК кроме архива,
-- сайт (p_public) — только опубликованные.
create function private.developer_price_hint(p_developer uuid, p_public boolean default false)
returns jsonb
language sql
stable
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
      and case when p_public then private.is_public_complex(c.id) else c.status <> 'archived' end
  ) as x
  where x.per_m2 > 0
  group by x.currency
  order by x.currency = 'USD' desc
  limit 1
$$;

revoke all on function private.developer_price_hint(uuid, boolean) from public;
grant execute on function private.developer_price_hint(uuid, boolean) to authenticated;

-- Программа для сайта: полей скидки нет вовсе — ни у «100% оплаты», ни у ступеней схемы. Текста
-- «Условия для клиента» тоже нет: сайт его не показывает, а свободный текст мог бы принести на сайт
-- слово «скидка» (PLAN §3б) — вернётся вместе с проверкой, когда понадобится странице ЖК.
create or replace function private.site_program(p public.payment_programs, p_checked_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'method', p.method,
    'bank', (select b.name from public.banks b where b.id = p.bank_id),
    'min_down_pct', p.min_down_pct,
    'tiers', (select coalesce(jsonb_agg(t.value - 'discount_pct' order by t.ordinality), '[]'::jsonb)
              from jsonb_array_elements(p.tiers) with ordinality as t),
    'terms', p.terms, 'fees', p.fees,
    'preset_months', to_jsonb(p.preset_months), 'allow_custom_months', p.allow_custom_months,
    'over_max_behavior', p.over_max_behavior, 'currency', p.currency,
    'blocks_scope', p.blocks_scope, 'block_ids', to_jsonb(private.public_block_ids(p.block_ids)),
    -- «Условия актуальны на» (Р5): позднее из правки и отметки «проверены».
    'updated_at', greatest(p.updated_at, p_checked_at)
  )
$$;

-- ─── «Расчёт для клиента» в кабинете (шаг 2.5, Р1, Р8) ──────────────────────────────────────

-- ЖК застройщика для калькулятора: блоки (валюта) и планировки — «цена от» и «доступна» как на
-- сайте (private.layout_offers). Кабинет — кроме архива, сайт (p_public) — только опубликованные.
create function private.calc_complexes(p_developer uuid, p_public boolean)
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
        from private.layout_offers o
        where o.block_id = b.id)
    ) order by b.sort, b.name), '[]'::jsonb)
    from public.blocks b
    where b.complex_id = c.id)
  ) order by c.sort, c.name), '[]'::jsonb)
  from public.complexes c
  where c.developer_id = p_developer
    and case when p_public then private.is_public_complex(c.id) else c.status <> 'archived' end
$$;

revoke all on function private.calc_complexes(uuid, boolean) from public;

-- Выбранный застройщик целиком: включённые программы (у сотрудников — со скидками; «выбранные»
-- без блоков не действуют — их нет), ЖК кроме архива с блоками и планировками («цена от» — как
-- на сайте, private.layout_offers), свободные квартиры с ценой (нет цены — null, «по запросу»).
create or replace function private.client_calc_developer(p_developer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'slug', d.slug, 'name', d.name,
    -- «Условия проверены» (Р5): «актуальны на» у программы — позднее из её правки и этой отметки.
    'checked_at', d.programs_checked_at,
    'price_hint', private.developer_price_hint(d.id),
    'programs', (
      select coalesce(jsonb_agg(to_jsonb(p) || jsonb_build_object('bank', bk.name)
        order by p.sort, p.created_at), '[]'::jsonb)
      from public.payment_programs p
      left join public.banks bk on bk.id = p.bank_id
      where p.developer_id = d.id and p.is_active
        and (p.blocks_scope = 'all' or cardinality(p.block_ids) > 0)),
    'complexes', private.calc_complexes(d.id, false),
    'units', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'number', u.number, 'floor', u.floor, 'block_id', u.block_id,
        'layout_id', u.layout_id, 'rooms', l.rooms, 'area', l.area,
        'price', coalesce(u.price, u.price_per_m2 * l.area)
      ) order by c.sort, b.sort, b.name, u.floor, u.number), '[]'::jsonb)
      from public.units u
      join public.blocks b on b.id = u.block_id
      join public.complexes c on c.id = b.complex_id
      left join public.layouts l on l.id = u.layout_id
      where c.developer_id = d.id and c.status <> 'archived' and u.status = 'free')
  )
  from public.developers d
  where d.id = p_developer
$$;

revoke all on function private.client_calc_developer(uuid) from public;

-- Экран расчёта: застройщики с включёнными программами (кроме архива) и выбранный целиком — по
-- адресу (?developer=slug), нет такого — первый. Руководитель и менеджер.
create or replace function public.client_calc_screen(p_developer text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Расчёт видит сотрудник' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  return (
    with listed as (
      select d.id, d.slug, d.name, d.sort
      from public.developers d
      where d.status <> 'archived'
        and exists (
          select 1 from public.payment_programs p
          where p.developer_id = d.id and p.is_active
            and (p.blocks_scope = 'all' or cardinality(p.block_ids) > 0))
    ), picked as (
      select l.id from listed l
      order by l.slug is not distinct from p_developer desc, l.sort, l.name
      limit 1
    )
    select jsonb_build_object(
      'developers', (select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'slug', l.slug, 'name', l.name)
        order by l.sort, l.name), '[]'::jsonb) from listed l),
      'current', (select private.client_calc_developer(p.id) from picked p)
    )
  );
end;
$$;

comment on function public.client_calc_screen(text) is
  '«Расчёт для клиента»: застройщики с включёнными программами и выбранный целиком (программы, ЖК, планировки, свободные квартиры).';

revoke all on function public.client_calc_screen(text) from public, anon;
grant execute on function public.client_calc_screen(text) to authenticated;

-- ─── Калькулятор сайта /kalkulyator (шаг 2.6, Р7–Р9) ─────────────────────────────────────────

-- Как «Расчёт для клиента», но для всех и без скидок (PLAN §3.13): опубликованные застройщики с
-- программами для опубликованных блоков; у выбранного (?developer=slug, нет такого — первый) —
-- программы без полей скидки (private.site_program), опубликованные ЖК с планировками и цена м²
-- по умолчанию. Квартир нет: расчёт квартиры получает её цену со страницы ЖК (шаг 2.7).
create function public.site_calc_screen(p_developer text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with listed as (
    select d.id, d.slug, d.name, d.sort, d.programs_checked_at
    from public.developers d
    where d.status = 'published'
      and exists (
        select 1 from public.payment_programs p
        where p.developer_id = d.id and p.is_active
          and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0))
  ), picked as (
    select l.* from listed l
    order by l.slug is not distinct from p_developer desc, l.sort, l.name
    limit 1
  )
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'developers', (
      select coalesce(jsonb_agg(jsonb_build_object('id', l.id, 'slug', l.slug, 'name', l.name)
        order by l.sort, l.name), '[]'::jsonb)
      from listed l),
    'current', (
      select jsonb_build_object(
        'id', k.id, 'slug', k.slug, 'name', k.name,
        'checked_at', k.programs_checked_at,
        'price_hint', private.developer_price_hint(k.id, true),
        'programs', (
          select coalesce(jsonb_agg(private.site_program(p, k.programs_checked_at)
            order by p.sort, p.created_at), '[]'::jsonb)
          from public.payment_programs p
          where p.developer_id = k.id and p.is_active
            and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)),
        'complexes', private.calc_complexes(k.id, true))
      from picked k)
  )
$$;

comment on function public.site_calc_screen(text) is
  '/kalkulyator: курс, опубликованные застройщики с программами и выбранный — программы без скидок, ЖК с планировками.';

revoke all on function public.site_calc_screen(text) from public;
grant execute on function public.site_calc_screen(text) to anon, authenticated, service_role;

-- ─── «Расчёт для этой квартиры» (шаг 2.7, мокапы SiteJkCalc1, MobFlat) ────────────────────────

-- Планировка опубликованного ЖК для расчёта на странице ЖК (фазы 3–5): блок и его валюта, ЖК,
-- застройщик с отметкой «Условия проверены», «цена от» и чертёж, свободные квартиры этой
-- планировки с ценой (как block_units: только свободные, без отделки и дат), программы блока —
-- без полей скидки (private.site_program, PLAN §3.13). Планировки нет на сайте, свободных нет или
-- цена «по запросу» — null: считать нечего, у такой планировки на странице ЖК — «Узнать цену».
create function public.site_layout_calc(p_layout uuid)
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
      select coalesce(jsonb_agg(private.site_program(p, d.programs_checked_at)
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
  where o.layout_id = p_layout and private.is_public_complex(c.id)
    and o.available and o.price_from > 0
$$;

comment on function public.site_layout_calc(uuid) is
  '«Расчёт для этой квартиры»: планировка опубликованного ЖК, её свободные квартиры с ценой и программы блока без скидок.';

revoke all on function public.site_layout_calc(uuid) from public;
grant execute on function public.site_layout_calc(uuid) to anon, authenticated, service_role;
