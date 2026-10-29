-- Фаза 5 (5D.2): обзор отчётов хода строительства для кабинета (мокап CabReview — матрица «Отчёты по ЖК ·
-- последние 6 месяцев» и «Видео для клиентов · последние»). Видят все сотрудники, и видеограф: в мокапе
-- матрица у него та же. Таблица отчётов видеографу отдаёт только свои строки (RLS), поэтому обзор —
-- функцией: по отчётам блоков только месяц, статус и дата публикации, без комментариев и файлов; по
-- опубликованным видео — подпись для списка и ссылку клиенту, только у ЖК на сайте (иначе ссылка — 404).

create function public.progress_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then jsonb_build_object(
    'complexes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name ->> 'ru',
        'built', not exists (
          select 1 from public.blocks b where b.complex_id = c.id and b.build_status = 'building'))), '[]'::jsonb)
      from public.complexes c
      where c.status <> 'archived' and exists (select 1 from public.blocks b where b.complex_id = c.id)),
    'reports', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', r.id, 'complex_id', r.complex_id, 'month', r.month, 'status', r.status,
        'published_at', r.published_at)), '[]'::jsonb)
      from public.progress_reports r
      where not r.is_unit and r.status in ('review', 'published')),
    'videos', (
      select coalesce(jsonb_agg(v.item order by v.published_at desc, v.id desc), '[]'::jsonb)
      from (
        select r.published_at, r.id, jsonb_build_object(
          'id', r.id, 'is_unit', r.is_unit, 'month', r.month, 'shot_at', r.created_at,
          'complex', c.name ->> 'ru', 'slug', c.slug, 'block', b.name,
          'unit', (select u.number from public.units u where u.id = r.unit_id),
          'author', (select p.full_name from public.profiles p where p.id = r.author_id),
          'thumb', (select ph.path from public.progress_photos ph where ph.report_id = r.id order by ph.sort limit 1)) as item
        from public.progress_reports r
        join public.complexes c on c.id = r.complex_id
        join public.blocks b on b.id = r.block_id
        where r.status = 'published' and private.is_public_complex(c.id)
        order by r.published_at desc, r.id desc
        limit 6
      ) v)
  ) end
$$;

comment on function public.progress_overview() is
  'Кабинет, фаза 5: матрица отчётов по ЖК (статусы отчётов блоков) и последние видео для клиентов.';

revoke all on function public.progress_overview() from public, anon;
grant execute on function public.progress_overview() to authenticated;
