-- Фаза 1 · шаг 9: хранилище фото, чертежей, фасадов, логотипов (PLAN §7: чтение — все,
-- запись — сотрудники; PLAN 3а). Решение фазы 1 (в. 2): браузер сам проверяет и уменьшает фото
-- и кладёт в бакет один файл ≤ 3200 px без EXIF. Право на запись проверяет RLS Storage тем же
-- хелпером, что и таблицы: загружает и удаляет только руководитель (PLAN §3.11).

-- ─── Бакет ──────────────────────────────────────────────────────────────────────────────

-- Публичный: next/image берёт файл по прямой ссылке (Netlify Image CDN). Имена файлов —
-- случайные UUID, поэтому фото черновика по ссылке не угадать.
-- 15 МБ — с запасом для уже уменьшенного файла: лимит 25 МБ на исходник проверяет браузер.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 15728640, array['image/jpeg', 'image/png'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ─── Путь файла ─────────────────────────────────────────────────────────────────────────

-- complexes/<id ЖК>/<uuid>.jpg или developers/<id застройщика>/<uuid>.png — тот же формат
-- собирает lib/media/path.ts. Всё о ЖК лежит в его папке: при окончательном удалении ЖК
-- (фаза 3) файлы удаляются по префиксу.
create function private.media_folder(complex uuid, developer uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when complex is not null then 'complexes/' || complex else 'developers/' || developer end
$$;

create function private.is_media_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    object_name ~ '^(complexes|developers)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'
    and case split_part(object_name, '/', 1)
      when 'complexes' then exists (
        select 1 from public.complexes c where c.id::text = split_part(object_name, '/', 2))
      else exists (
        select 1 from public.developers d where d.id::text = split_part(object_name, '/', 2))
    end,
    false
  )
$$;

revoke all on function private.media_folder(uuid, uuid), private.is_media_path(text) from public;
grant execute on function private.media_folder(uuid, uuid), private.is_media_path(text)
  to authenticated, service_role;

-- Запись в media_assets ссылается только на файл из папки своего владельца.
alter table public.media_assets
  add constraint media_assets_path_in_owner_folder
  check (starts_with(path, private.media_folder(complex_id, developer_id) || '/'));

-- ─── Права (PLAN §5) ────────────────────────────────────────────────────────────────────

-- Сайт читает файлы по публичной ссылке, мимо RLS; список файлов бакета ему не нужен.
-- Чтение сотрудникам нужно и самому Storage: загрузка возвращает созданную строку.
create policy "media: сотрудники видят файлы"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (select private.is_staff()));

create policy "media: загружает руководитель"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'media'
    and (select private.has_role('head'))
    and private.is_media_path(name)
  );

-- Файл не перезаписывается: новое фото — новый файл, кадр меняется точкой фокуса в media_assets.
-- Поэтому политики на update нет.
create policy "media: удаляет руководитель"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (select private.has_role('head')));
