-- Фаза 5 (5C.3): кадры стройки для главной и каталога (мокап Main: второй кадр карточки ЖК
-- «Стройка · Октябрь» и плитка «Видео стройки · Смотреть пример»). Для каждого ЖК на сайте —
-- последний по месяцу опубликованный отчёт строящегося блока (не квартиры: видео квартир — для
-- клиентов по ссылке; сданный дом «Стройкой» не показываем) и его первые 4 фото. Отдельной функцией, а не полем site_catalog, чтобы не копировать её тело;
-- сайт читает обе под одним тегом кэша каталога (публикация отчёта его сбрасывает).

create function public.site_progress_frames()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'complex_id', last.complex_id, 'report_id', last.id, 'month', last.month,
      'published_at', last.published_at, 'block', last.block,
      'photos', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'path', ph.path, 'width', ph.width, 'height', ph.height, 'blur', ph.blur)
          order by ph.sort), '[]'::jsonb)
        from (select p.* from public.progress_photos p
              where p.report_id = last.id order by p.sort limit 4) ph))
    order by last.published_at desc), '[]'::jsonb)
  from (
    select distinct on (r.complex_id) r.id, r.complex_id, r.month, r.published_at, b.name as block
    from public.progress_reports r
    join public.blocks b on b.id = r.block_id
    where r.status = 'published' and not r.is_unit and b.build_status = 'building'
      and private.is_public_complex(r.complex_id)
    order by r.complex_id, r.month desc, r.published_at desc, r.id desc
  ) last
$$;

comment on function public.site_progress_frames() is
  'Сайт, фаза 5: последний опубликованный отчёт блока каждого ЖК на сайте и его первые 4 фото (карточка каталога, главная).';

revoke all on function public.site_progress_frames() from public;
grant execute on function public.site_progress_frames() to anon, authenticated;
