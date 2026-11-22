-- Правки 15.11, п. 4 (уточнение 20.11): рекламодатель — не только застройщик («lyuboyni ham qo‘ya olamiz…
-- asosan quruvchilarni»). У рекламы — застройщик из списка ИЛИ название рекламодателя текстом (одно из
-- двух обязательно). На сайте подпись баннера — название рекламодателя, иначе имя застройщика. Кнопка —
-- по-прежнему телефон Vodiy House или заявка (ТЗ 1.2: контактов рекламодателя на сайте нет). Реклама без
-- застройщика видна по своему периоду и выключателю; реклама застройщика — ещё и пока он опубликован.
-- Остальное в site_showcase() — как в 20261117150000_showcase_discount_switch.sql.

alter table public.ads
  alter column developer_id drop not null,
  add column advertiser text
    check (advertiser is null or char_length(btrim(advertiser)) between 1 and 80),
  add constraint ads_advertiser_present check (developer_id is not null or advertiser is not null);

comment on column public.ads.advertiser is
  'Рекламодатель не из застройщиков (правки 15.11, п. 4, 20.11) — подпись баннера на сайте; у застройщика — его имя.';

-- Реклама на сайте: включена, период идёт; у застройщика — он опубликован.
create function private.ad_visible(p_active boolean, p_from date, p_to date, p_developer uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_active, false)
    and private.tashkent_today() between p_from and p_to
    and (p_developer is null or private.is_public_developer(p_developer))
$$;

revoke all on function private.ad_visible(boolean, date, date, uuid) from public;
grant execute on function private.ad_visible(boolean, date, date, uuid) to anon, authenticated, service_role;

-- Прежняя политика чтения (имя длиннее 63 байт — в базе оно обрезано): ищем по таблице и команде.
do $$
declare
  old_policy record;
begin
  for old_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'ads' and cmd = 'SELECT' and policyname like 'ads: сайт%'
  loop
    execute format('drop policy %I on public.ads', old_policy.policyname);
  end loop;
end;
$$;

create policy "ads: сайт — действующие, сотрудники — все"
  on public.ads for select to anon, authenticated
  using (private.ad_visible(is_active, valid_from, valid_to, developer_id) or (select private.is_staff()));

create or replace function public.site_showcase()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'today', private.tashkent_today(),
    'collections', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', k.id, 'slug', k.slug, 'title', k.title, 'mode', k.mode, 'filter', k.filter,
          'complex_ids', private.showcase_public_complexes(k.complex_ids),
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.collection_id = k.id and m.kind = 'cover'))
        order by k.sort, k.created_at)
      from public.collections k
      where k.is_active), '[]'::jsonb),
    'specials', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'kind', s.kind, 'badge', s.badge, 'title', s.title, 'text', s.text,
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'complex_ids', private.showcase_public_complexes(s.complex_ids),
          'valid_to', s.valid_to,
          'cover', (select private.site_media(m) from public.media_assets m
                    where m.special_id = s.id and m.kind = 'cover'))
        order by s.sort, s.created_at)
      from public.specials s
      join public.developers d on d.id = s.developer_id
      where private.showcase_visible(s.is_active, s.valid_from, s.valid_to, s.developer_id)
        and (private.site_shows_discounts()
          or not (private.mentions_discount(s.badge)
            or private.mentions_discount(s.title)
            or coalesce(private.mentions_discount(s.text), false)))), '[]'::jsonb),
    'ads', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', a.id, 'title', a.title, 'cta', a.cta,
          'advertiser', coalesce(nullif(btrim(a.advertiser), ''), d.name),
          'developer', case when d.id is null then null
                            else jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name) end,
          'valid_to', a.valid_to,
          'banner', private.site_media(banner),
          'banner_mobile', (select private.site_media(m) from public.media_assets m
                            where m.ad_id = a.id and m.kind = 'banner_mobile'))
        order by a.sort, a.created_at)
      from public.ads a
      left join public.developers d on d.id = a.developer_id
      join public.media_assets banner on banner.ad_id = a.id and banner.kind = 'banner'
      where private.ad_visible(a.is_active, a.valid_from, a.valid_to, a.developer_id)), '[]'::jsonb)
  )
$$;

-- Напоминание руководителю о конце периода: у рекламы без застройщика — название рекламодателя.
create or replace function public.take_showcase_reminders()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := private.tashkent_today();
  v_items jsonb;
begin
  -- Отметки удалённых записей (и DEMO после demo:remove) — чтобы таблица не росла без дела.
  delete from public.showcase_notices n
  where (n.kind = 'special' and not exists (select 1 from public.specials s where s.id = n.entity_id))
     or (n.kind = 'ad' and not exists (select 1 from public.ads a where a.id = n.entity_id));
  with due as (
    select 'special'::text as kind, s.id, s.title, d.name as developer, s.valid_to
    from public.specials s
    join public.developers d on d.id = s.developer_id
    where s.is_active and s.valid_to between v_today and v_today + 3
      and not exists (select 1 from public.showcase_notices n
                      where n.kind = 'special' and n.entity_id = s.id and n.valid_to = s.valid_to)
    union all
    select 'ad', a.id, a.title, coalesce(nullif(btrim(a.advertiser), ''), d.name), a.valid_to
    from public.ads a
    left join public.developers d on d.id = a.developer_id
    where a.is_active and a.valid_to between v_today and v_today + 3
      and not exists (select 1 from public.showcase_notices n
                      where n.kind = 'ad' and n.entity_id = a.id and n.valid_to = a.valid_to)
  ),
  marked as (
    insert into public.showcase_notices (kind, entity_id, valid_to)
    select due.kind, due.id, due.valid_to from due
    returning entity_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'kind', due.kind, 'id', due.id, 'title', due.title, 'developer', due.developer, 'valid_to', due.valid_to)
    order by due.valid_to, due.title ->> 'ru'), '[]'::jsonb)
    into v_items
  from due;
  return v_items;
end;
$$;
