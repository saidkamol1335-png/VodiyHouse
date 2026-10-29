-- Фаза 5, ревью блока 5C: сайту — признак отчёта по квартире. Тело — как в 20261029120000_progress_site.sql,
-- кроме ключа is_unit (помечен).

create or replace function private.site_progress_report(r public.progress_reports)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    -- Ревью 5C: видео этой же квартиры в «Предыдущих месяцах» — «Видео этой квартиры», а не «Видео блока».
    'is_unit', r.is_unit,
    'month', r.month,
    'shot_at', r.created_at,
    'comment', r.comment,
    'youtube_id', r.youtube_id,
    'video_path', r.video_path,
    'block', (
      select jsonb_build_object(
        'id', b.id, 'name', b.name, 'build_status', b.build_status, 'progress_pct', b.progress_pct,
        'floors_total', b.floors_total, 'floors_built', b.floors_built,
        'deadline_year', b.deadline_year, 'deadline_quarter', b.deadline_quarter)
      from public.blocks b where b.id = r.block_id),
    'photos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'path', p.path, 'width', p.width, 'height', p.height, 'blur', p.blur) order by p.sort), '[]'::jsonb)
      from public.progress_photos p where p.report_id = r.id)
  )
$$;
