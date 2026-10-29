-- Фаза 5 (5A.3): ход строительства на сайте (мокап SiteJk / MobJkProg — раздел «Ход строительства»,
-- SiteVideo / MobVideo — видео квартиры для клиента). Только опубликованные отчёты видимого ЖК, отдельными
-- RPC, как «Выбрать квартиру» (site_complex_picker): страница ЖК кладёт ответ в ту же запись кэша.
-- Видео квартиры — по id отчёта (ссылка менеджера клиенту): без номера квартиры, id квартиры и цены;
-- «Предыдущие месяцы» — другие отчёты этой квартиры и отчёты её блока (мокап repsForUnit).

-- Отчёт для сайта: месяц, когда снят, комментарий, видео (YouTube или файл), фото по порядку и блок —
-- его готовность и срок («Готовность блока B · 58% · 7 из 12 этажей · Сдача: 4 кв. 2027»).
create function private.site_progress_report(r public.progress_reports)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
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

-- Раздел «Ход строительства» страницы ЖК: отчёты по блокам, новые сверху (12 — с запасом на чипы
-- мокапа: до 5 на 1440, до 6 на 390, у ЖК с несколькими блоками — по отчёту на блок за месяц).
-- Пустой список — раздела и пункта навигатора нет.
create function public.site_complex_progress(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.can_see_complex(p_complex) then (
    select coalesce(jsonb_agg(private.site_progress_report(r) order by r.month desc, b.sort, b.name), '[]'::jsonb)
    from public.progress_reports r
    join public.blocks b on b.id = r.block_id
    where r.id in (
      select pr.id
      from public.progress_reports pr
      join public.blocks pb on pb.id = pr.block_id
      where pr.complex_id = p_complex and pr.status = 'published' and not pr.is_unit
      order by pr.month desc, pb.sort, pb.name
      limit 12
    )
  ) end
$$;

-- Видео квартиры для клиента: опубликованный отчёт по квартире видимого ЖК, иначе null (404).
-- Квартира — снимком из отчёта: планировка (для расчёта), комнаты, площадь, этаж; номера нет.
create function public.site_unit_video(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select private.site_progress_report(r) || jsonb_build_object(
    'complex', (
      select jsonb_build_object('id', c.id, 'slug', c.slug, 'name', c.name,
        'developer', (select d.name from public.developers d where d.id = c.developer_id))
      from public.complexes c where c.id = r.complex_id),
    'layout_id', r.layout_id,
    'rooms', r.unit_rooms,
    'area', r.unit_area,
    'floor', r.unit_floor,
    'history', (
      select coalesce(jsonb_agg(private.site_progress_report(h) order by h.month desc, h.created_at desc), '[]'::jsonb)
      from public.progress_reports h
      where h.id in (
        select x.id from public.progress_reports x
        where x.status = 'published' and x.id <> r.id
          and ((x.is_unit and r.unit_id is not null and x.unit_id = r.unit_id) or (not x.is_unit and x.block_id = r.block_id))
        order by x.month desc, x.created_at desc
        limit 6
      ))
  )
  from public.progress_reports r
  where r.id = p_id and r.status = 'published' and r.is_unit and private.can_see_complex(r.complex_id)
$$;

comment on function public.site_complex_progress(uuid) is
  'Сайт, «Ход строительства»: опубликованные отчёты по блокам видимого ЖК, новые сверху.';
comment on function public.site_unit_video(uuid) is
  'Сайт, видео квартиры для клиента: опубликованный отчёт по квартире без номера, id квартиры и цены.';

revoke all on function private.site_progress_report(public.progress_reports) from public, anon, authenticated;
revoke all on function public.site_complex_progress(uuid), public.site_unit_video(uuid) from public;
grant execute on function public.site_complex_progress(uuid), public.site_unit_video(uuid) to anon, authenticated;
