-- Страницы застройщиков (шаг 3.15, 3б; ТЗ 8, мокап SiteDevs / SiteDev): список и страница ролью
-- посетителя. ЖК, программы оплаты и проверки по ЖК страница берёт из site_catalog() — здесь только
-- своё: о компании и основателях, логотип и фон, сданные объекты. Контакты застройщика
-- (developer_private) наружу не попадают никогда (правило ТЗ 1.2).

create function public.site_developers()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', d.id, 'slug', d.slug, 'name', d.name, 'founded_year', d.founded_year,
        'delivered_checked_at', d.delivered_checked_at,
        'logo', (select private.site_media(m) from public.media_assets m
                 where m.developer_id = d.id and m.kind = 'logo'))
      order by d.sort, d.name)
    from public.developers d
    where d.status = 'published'
  ), '[]'::jsonb)
$$;

create function public.site_developer(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'slug', d.slug, 'name', d.name, 'about', d.about, 'founders', d.founders,
    'founded_year', d.founded_year, 'flats_delivered', d.flats_delivered,
    'delivered_checked_at', d.delivered_checked_at,
    'logo', (select private.site_media(m) from public.media_assets m
             where m.developer_id = d.id and m.kind = 'logo'),
    'cover', (select private.site_media(m) from public.media_assets m
              where m.developer_id = d.id and m.kind = 'cover'),
    'past_projects', coalesce((
      select jsonb_agg(jsonb_build_object(
          'name', p.name, 'planned_on', p.planned_on, 'delivered_on', p.delivered_on)
        order by p.sort, p.id)
      from public.developer_past_projects p
      where p.developer_id = d.id), '[]'::jsonb))
  from public.developers d
  where d.slug = p_slug and d.status = 'published'
$$;

-- Застройщик в архиве — страница отвечает временным редиректом на список (его могут восстановить).
-- Удалённый — 404 как любой чужой адрес: в retired_slugs пишутся только адреса ЖК (в рекламу и
-- поиск уходят ссылки на ЖК, не на застройщиков).
create function public.site_developer_slug_state(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.developers d where d.slug = p_slug and d.status = 'archived')
      then 'archived'
  end
$$;

revoke all on function public.site_developers() from public;
revoke all on function public.site_developer(text) from public;
revoke all on function public.site_developer_slug_state(text) from public;
grant execute on function public.site_developers() to anon, authenticated, service_role;
grant execute on function public.site_developer(text) to anon, authenticated, service_role;
grant execute on function public.site_developer_slug_state(text) to anon, authenticated, service_role;
