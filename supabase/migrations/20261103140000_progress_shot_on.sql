-- Проект-2, фаза E (PLAN §10, пп. 13, 31–33, 38): кабинет мобилографа — дата съёмки, черновики,
-- загрузки до проверки в приватном бакете incoming.
-- Дата съёмки (shot_on) — день, месяц отчёта считается из неё (month остаётся колонкой: на ней индексы,
-- сайт, матрица и напоминание). Черновик видит только автор; комментарий черновика и возвращённого может
-- быть на одном языке. Новые файлы отчёта лежат в incoming/<автор>/<ЖК>/<uuid>, в публичные бакеты
-- (media, progress-video) их копирует сервер секретным ключом при публикации — адрес копии назначает база
-- (publish_path). Опубликованный отчёт на incoming не ссылается. Функции — 20261103150000.

-- ─── Дата съёмки ─────────────────────────────────────────────────────────────────────────
alter table public.progress_reports add column shot_on date;

-- Перенос: день отправки внутри месяца отчёта; без сдвига updated_at и без записей журнала.
alter table public.progress_reports disable trigger progress_reports_set_updated_at;
alter table public.progress_reports disable trigger progress_reports_audit;
update public.progress_reports set shot_on = greatest(
  month,
  least((created_at at time zone 'Asia/Tashkent')::date, (month + interval '1 month' - interval '1 day')::date)
);
alter table public.progress_reports enable trigger progress_reports_set_updated_at;
alter table public.progress_reports enable trigger progress_reports_audit;

alter table public.progress_reports
  alter column shot_on set not null,
  add constraint progress_reports_month_of_shot check (month = date_trunc('month', shot_on)::date);

-- ─── Комментарий: у черновика и возвращённого — можно на одном языке ─────────────────────
alter table public.progress_reports alter column comment type jsonb using comment::jsonb;
alter table public.progress_reports add constraint progress_reports_comment_shape check (
  jsonb_typeof(comment) = 'object'
  and comment - 'ru' - 'uz' = '{}'::jsonb
  and jsonb_typeof(comment -> 'ru') = 'string'
  and jsonb_typeof(comment -> 'uz') = 'string'
  and (status in ('draft', 'returned') or (btrim(comment ->> 'ru') <> '' and btrim(comment ->> 'uz') <> ''))
);

-- ─── Пути файлов: публичные (старые и опубликованные) или incoming ───────────────────────
-- Прежние проверки путей — безымянные (имя выбрал Postgres): снимаем по определению.
do $$
declare
  c record;
begin
  for c in
    select con.conrelid::regclass as tbl, con.conname
    from pg_constraint con
    where con.contype = 'c'
      and con.conrelid in ('public.progress_photos'::regclass, 'public.progress_reports'::regclass)
      and pg_get_constraintdef(con.oid) like '%complexes/%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end
$$;
alter table public.progress_photos add constraint progress_photos_path_ok check (
  (path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$')
  and split_part(path, '/', 2) = complex_id::text
);
alter table public.progress_reports add constraint progress_reports_video_path_ok check (
  video_path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$' or video_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'
);

-- Адрес копии при публикации — назначает только база (progress_publish_files).
alter table public.progress_photos add column publish_path text unique check (
  publish_path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and split_part(publish_path, '/', 2) = complex_id::text
);
alter table public.progress_reports add column video_publish_path text unique check (
  video_publish_path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'
  and split_part(video_publish_path, '/', 2) = complex_id::text
);
-- Опубликованный отчёт — только публичные пути (фото проверяет publish_progress_report).
alter table public.progress_reports add constraint progress_reports_published_public check (
  status <> 'published' or ((video_path is null or video_path like 'complexes/%') and video_publish_path is null)
);

-- Адрес копии видео (progress_publish_files) — не правка отчёта: версия (updated_at), которую видел
-- руководитель в ящике, остаётся, и повтор публикации после сбоя копии не упирается в «обновите страницу».
create function private.progress_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Явная новая версия («Убрать кадр») — как задана.
  if new.updated_at is distinct from old.updated_at then
    return new;
  end if;
  if (to_jsonb(new) - 'video_publish_path' - 'updated_at') = (to_jsonb(old) - 'video_publish_path' - 'updated_at') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger progress_reports_set_updated_at on public.progress_reports;
create trigger progress_reports_set_updated_at before update on public.progress_reports
  for each row execute function private.progress_set_updated_at();

-- ─── Один отчёт на блок за месяц — без черновиков (дубль ловит «На проверку») ────────────
drop index public.progress_reports_block_month;
create unique index progress_reports_block_month on public.progress_reports (block_id, month)
  where not is_unit and status <> 'draft';
create index progress_reports_author_status_idx on public.progress_reports (author_id, status);

-- ─── Черновик видит только автор (п. 32) ─────────────────────────────────────────────────
drop policy "progress_reports: читают руководитель и менеджер, видеограф — свои" on public.progress_reports;
create policy "progress_reports: руководитель и менеджер — кроме черновиков, автор — свои"
  on public.progress_reports for select to authenticated
  using (
    (status <> 'draft' and (select private.has_role('head', 'manager')))
    or (author_id = (select auth.uid()) and (select private.has_role('head', 'mobilographer')))
  );

-- ─── Хранилище (п. 13, 31) ───────────────────────────────────────────────────────────────
-- Копию публикации (publish_path) менеджер не сотрёт, как и файл отчёта (ревью фазы E).
drop policy "media: менеджер удаляет файлы-сироты ЖК" on storage.objects;
create policy "media: менеджер удаляет файлы-сироты ЖК"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'media'
    and (select private.has_role('manager'))
    and name like 'complexes/%'
    and not exists (select 1 from public.media_assets m where m.path = objects.name)
    and not exists (select 1 from public.progress_photos p where p.path = objects.name or p.publish_path = objects.name)
    and (owner = (select auth.uid()) or created_at < now() - interval '1 hour')
  );

-- В публичные бакеты файлы отчётов пишет только сервер (копия при публикации).
drop policy "media: видеограф загружает фото отчётов" on storage.objects;
drop policy "progress-video: загружают видеограф и руководитель" on storage.objects;

-- 50 МБ — лимит файла бесплатного тарифа Supabase; на Pro поднимается правкой бакета, без кода.
update storage.buckets set file_size_limit = 52428800 where id in ('incoming', 'progress-video');

-- Статус отчёта, который ссылается на файл incoming (null — ни один).
create function private.incoming_ref(object_name text)
returns public.progress_status
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select r.status from public.progress_photos p join public.progress_reports r on r.id = p.report_id
      where p.path = object_name limit 1),
    (select r.status from public.progress_reports r where r.video_path = object_name limit 1)
  )
$$;

revoke all on function private.incoming_ref(text) from public, anon;
grant execute on function private.incoming_ref(text) to authenticated, service_role;

drop policy "incoming: мобилограф и руководитель загружают свои файлы" on storage.objects;
drop policy "incoming: автор видит свои, руководитель — все" on storage.objects;
drop policy "incoming: автор удаляет свои, руководитель — все" on storage.objects;

-- Имя, уже упомянутое в отчёте, не загрузить заново; update-политики нет — файл не подменить.
create policy "incoming: мобилограф и руководитель загружают в свою папку"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'incoming'
    and (select private.has_role('head', 'mobilographer'))
    and private.is_incoming_path(name)
    and private.incoming_ref(name) is null
  );

-- Чужие файлы (ящик проверки, правка возвращённого) — только подписанными сервером адресами.
create policy "incoming: видна только своя папка"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'incoming'
    and (select private.has_role('head', 'mobilographer'))
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

-- Файл отчёта на проверке или опубликованного не удалить.
create policy "incoming: удаляется свой файл без отчёта, черновика или возвращённого"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'incoming'
    and (select private.has_role('head', 'mobilographer'))
    and split_part(name, '/', 1) = (select auth.uid())::text
    and coalesce(private.incoming_ref(name) in ('draft', 'returned'), true)
  );

comment on column public.progress_reports.shot_on is 'Фаза E: дата съёмки; month = её месяц.';
comment on column public.progress_photos.publish_path is
  'Фаза E: адрес копии в media при публикации (назначает база, пишет сервер).';
comment on column public.progress_reports.video_publish_path is
  'Фаза E: адрес копии видео в progress-video при публикации.';
