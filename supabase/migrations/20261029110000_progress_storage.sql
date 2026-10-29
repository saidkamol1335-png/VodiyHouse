-- Фаза 5 (5A.2): файлы отчётов хода строительства (мокап CabVideo: «Загрузить видео с телефона · если
-- связь оборвётся, загрузка продолжится с того же места»).
-- Фото — бакет media, папка ЖК (её чистит удаление ЖК из архива): видеограф загружает только JPEG в папку
-- существующего ЖК — браузер уменьшает фото, как у галереи. Видео — бакет progress-video: публичный (плеер
-- берёт файл по ссылке, имена — UUID), только MP4. С телефона — загрузкой с докачкой (TUS Storage): права —
-- те же политики insert. Удаляет файлы отчёта сервер по путям, которые вернули функции отчётов
-- (submit_progress_report, delete_progress_report); видеограф сам в хранилище ничего не удаляет.

-- Лимит файла — общий лимит проекта (на бесплатном тарифе Supabase — 50 МБ). «MP4 до 4 ГБ» мокапа —
-- после ответа о тарифе (PROGRESS, вопрос 3); до него основной путь видео — ссылка YouTube.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-video', 'progress-video', true, null, array['video/mp4'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- complexes/<id ЖК>/<uuid>.mp4 — тот же формат собирает lib/media/path.ts (progressVideoPath).
create function private.is_progress_video_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    object_name ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'
    and exists (select 1 from public.complexes c where c.id::text = split_part(object_name, '/', 2)),
    false
  )
$$;

revoke all on function private.is_progress_video_path(text) from public, anon;
grant execute on function private.is_progress_video_path(text) to authenticated, service_role;

create policy "media: видеограф загружает фото отчётов"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select private.has_role('videographer'))
    and name ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    and private.is_media_path(name)
  );

create policy "progress-video: сотрудники видят файлы"
  on storage.objects for select to authenticated
  using (bucket_id = 'progress-video' and (select private.is_staff()));

create policy "progress-video: загружают видеограф и руководитель"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-video'
    and (select private.has_role('head', 'videographer'))
    and private.is_progress_video_path(name)
  );

-- Файл не перезаписывается (новое видео — новый файл), поэтому политики на update нет.
create policy "progress-video: удаляет руководитель"
  on storage.objects for delete to authenticated
  using (bucket_id = 'progress-video' and (select private.has_role('head')));
