-- Правки 15.11, п. 4 + 21 (ревью блока C): «Скидки на сайте» — выключатель руководителя, публичная
-- запись settings `site.show_discounts`. Пока он выключен (записи нет — тоже выключен), site_showcase()
-- не отдаёт спецпредложения со скидкой в бейдже, заголовке или тексте (private.mentions_discount —
-- та же проверка, что @vh/shared/discounts). Раньше их прятал только код сайта, а сама функция ролью
-- посетителя отдавала тексты целиком. Остальное — как в 20261117140000_ad_banners.sql.

create function private.site_shows_discounts()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((
    select case when jsonb_typeof(s.value -> 'enabled') = 'boolean' then (s.value ->> 'enabled')::boolean end
    from public.settings s
    where s.key = 'site.show_discounts'), false)
$$;

revoke all on function private.site_shows_discounts() from public;
grant execute on function private.site_shows_discounts() to anon, authenticated, service_role;

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
          'developer', jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name),
          'valid_to', a.valid_to,
          'banner', private.site_media(banner),
          'banner_mobile', (select private.site_media(m) from public.media_assets m
                            where m.ad_id = a.id and m.kind = 'banner_mobile'))
        order by a.sort, a.created_at)
      from public.ads a
      join public.developers d on d.id = a.developer_id
      join public.media_assets banner on banner.ad_id = a.id and banner.kind = 'banner'
      where private.showcase_visible(a.is_active, a.valid_from, a.valid_to, a.developer_id)), '[]'::jsonb)
  )
$$;
