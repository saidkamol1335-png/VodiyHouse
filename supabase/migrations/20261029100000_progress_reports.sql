-- Фаза 5 (5A.1): отчёты хода строительства и видео квартир (PLAN §7 «Фаза 5»; мокап CabVideo, CabReview,
-- раздел «Ход строительства» SiteJk / MobJkProg, SiteVideo / MobVideo).
-- Отчёт — блок ЖК за месяц (у ЖК с одним блоком — он; так в мокапе), по желанию — квартира: 3–15 фото,
-- комментарий RU и UZ, видео — ролик YouTube или файл mp4 в Storage (бакет — шаг 5A.2). Месяц — текущий или
-- прошлый по Ташкенту. Отчёт по блоку — один за месяц, по квартире — сколько угодно.
-- Видеограф и руководитель отправляют отчёт на проверку; менеджер и руководитель публикуют с отметкой
-- правила 1.2 или возвращают с причиной — видеограф исправляет и отправляет снова; снять с публикации —
-- руководитель (отчёт снова на проверке). Пишут только RPC (security definer): прямой записи в таблицы нет
-- ни у кого. Читают сотрудники: руководитель и менеджер — все отчёты, видеограф — свои; сайт — через
-- функции site_* (шаг 5A.3), посетителю таблицы закрыты.

create type public.progress_status as enum ('review', 'returned', 'published');

create table public.progress_reports (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  -- Отчёт по квартире — видео для клиента по ссылке. Квартиру могут удалить правкой списка: отчёт и
  -- ссылка остаются (is_unit и снимок квартиры ниже), пропадает только связь. Номер квартиры не хранится:
  -- клиенту его не показываем.
  is_unit boolean not null default false,
  unit_id uuid references public.units (id) on delete set null,
  layout_id uuid references public.layouts (id) on delete set null,
  unit_rooms smallint check (unit_rooms between 0 and 10),
  unit_area numeric(6, 2) check (unit_area > 0 and unit_area < 1000),
  unit_floor smallint check (unit_floor between -5 and 100),
  -- Первое число месяца отчёта.
  month date not null check (month = date_trunc('month', month)::date),
  comment public.i18n_text not null check (length(comment ->> 'ru') <= 300 and length(comment ->> 'uz') <= 300),
  youtube_id text check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_path text check (video_path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$'),
  status public.progress_status not null default 'review',
  -- Причина возврата — видеографу; снимается при повторной отправке.
  return_note text check (length(btrim(return_note)) between 1 and 300),
  author_id uuid references public.profiles (id) on delete set null,
  -- Кто и когда опубликовал — с отметкой «Проверено по правилу 1.2» (без неё функция не публикует).
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (youtube_id is null or video_path is null),
  check (video_path is null or split_part(video_path, '/', 2) = complex_id::text),
  check (is_unit or (unit_id is null and layout_id is null and unit_rooms is null and unit_area is null and unit_floor is null)),
  check ((status = 'published') = (published_at is not null)),
  check ((status = 'returned') = (return_note is not null))
);

create unique index progress_reports_block_month on public.progress_reports (block_id, month) where not is_unit;
create index progress_reports_complex_idx on public.progress_reports (complex_id, status, month desc);
create index progress_reports_unit_idx on public.progress_reports (unit_id) where unit_id is not null;
create index progress_reports_author_idx on public.progress_reports (author_id, created_at desc);

-- Фото отчёта: бакет media, папка ЖК (её чистит удаление ЖК из архива), без подписей — как вся галерея.
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.progress_reports (id) on delete cascade,
  complex_id uuid not null references public.complexes (id) on delete cascade,
  path text not null unique check (
    path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' and split_part(path, '/', 2) = complex_id::text
  ),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  blur text check (length(blur) <= 4000),
  sort smallint not null check (sort between 1 and 15),
  unique (report_id, sort)
);

create index progress_photos_report_idx on public.progress_photos (report_id, sort);
create index progress_photos_complex_idx on public.progress_photos (complex_id);
create index progress_reports_block_idx on public.progress_reports (block_id);
create index progress_reports_layout_idx on public.progress_reports (layout_id) where layout_id is not null;
-- Один файл — один отчёт: удаление отчёта удаляет и его файл.
create unique index progress_reports_video_path on public.progress_reports (video_path) where video_path is not null;

create trigger progress_reports_set_updated_at before update on public.progress_reports
  for each row execute function public.set_updated_at();
-- Журнал — по отчёту; фото меняются только вместе с ним (отправка целиком), отдельных записей не нужно.
create trigger progress_reports_audit after insert or update or delete on public.progress_reports
  for each row execute function private.write_audit();

alter table public.progress_reports enable row level security;
alter table public.progress_photos enable row level security;

create policy "progress_reports: читают руководитель и менеджер, видеограф — свои"
  on public.progress_reports for select to authenticated
  using (
    (select private.has_role('head', 'manager'))
    or (author_id = (select auth.uid()) and (select private.has_role('videographer')))
  );
create policy "progress_photos: читает тот, кто видит отчёт"
  on public.progress_photos for select to authenticated
  using (exists (select 1 from public.progress_reports r where r.id = report_id));

revoke all on public.progress_reports, public.progress_photos from anon, authenticated;
grant select on public.progress_reports, public.progress_photos to authenticated;

-- ─── Кабинет ─────────────────────────────────────────────────────────────────────────────

-- Отправить на проверку: новый отчёт (без id) или возвращённый — исправленный целиком. p_report:
-- {id?, block_id, unit_id?, month, comment {ru, uz}, youtube_id?, video_path?,
--  photos [{path, width, height, blur?}] — 3–15, по порядку}.
-- Возвращает отчёт, ЖК и файлы, которые больше не нужны (их удаляет сервер): {id, complex_id, removed}.
create function public.submit_progress_report(p_report jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_block uuid;
  v_unit uuid;
  v_month date;
  v_complex uuid;
  v_today date := private.tashkent_today();
  v_current date;
  v_unit_status public.unit_status;
  v_layout uuid;
  v_rooms smallint;
  v_area numeric;
  v_floor smallint;
  v_photos jsonb := p_report -> 'photos';
  v_youtube text := nullif(btrim(p_report ->> 'youtube_id'), '');
  v_video text := nullif(btrim(p_report ->> 'video_path'), '');
  v_comment jsonb := p_report -> 'comment';
  v_old public.progress_reports;
  v_removed jsonb := '[]';
begin
  if not private.has_role('head', 'videographer') then
    raise exception 'Отчёты отправляют видеограф и руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  begin
    v_id := nullif(p_report ->> 'id', '')::uuid;
    v_block := nullif(p_report ->> 'block_id', '')::uuid;
    v_unit := nullif(p_report ->> 'unit_id', '')::uuid;
    v_month := nullif(p_report ->> 'month', '')::date;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Отчёт заполнен неверно — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end;

  select b.complex_id into v_complex from public.blocks b where b.id = v_block;
  if v_complex is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if private.locked_complex_status(v_complex) = 'archived' then
    raise exception 'ЖК в архиве — отчёт не нужен' using errcode = 'check_violation', hint = 'vh:archived';
  end if;

  -- Повторная отправка — только возвращённого отчёта, его автором или руководителем, в том же ЖК.
  if v_id is not null then
    select * into v_old from public.progress_reports r where r.id = v_id for update;
    if not found or not (private.has_role('head') or v_old.author_id = auth.uid()) then
      raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    if v_old.status <> 'returned' then
      raise exception 'Отчёт уже на проверке или опубликован — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
    end if;
    if v_old.complex_id <> v_complex then
      raise exception 'Отчёт заполнен неверно — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
    end if;
  end if;

  -- Месяц отчёта — текущий или прошлый (мокап: «Октябрь 2026 | Сентябрь 2026»); возвращённый отчёт
  -- сохраняет свой месяц, даже если тот уже позади.
  v_current := date_trunc('month', v_today)::date;
  if v_month is null or (
    v_month not in (v_current, (v_current - interval '1 month')::date)
    and v_month is distinct from v_old.month
  ) then
    raise exception 'Месяц отчёта — текущий или прошлый' using errcode = 'check_violation', hint = 'vh:month';
  end if;

  if v_unit is not null then
    select u.status, u.layout_id, l.rooms, l.area, u.floor
      into v_unit_status, v_layout, v_rooms, v_area, v_floor
      from public.units u left join public.layouts l on l.id = u.layout_id
     where u.id = v_unit and u.block_id = v_block;
    if not found then
      raise exception 'Квартира не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    if v_unit_status = 'sold' then
      raise exception 'Квартира продана — видео для клиента не нужно' using errcode = 'check_violation', hint = 'vh:sold';
    end if;
  end if;

  if jsonb_typeof(v_comment) is distinct from 'object'
     or coalesce(length(btrim(v_comment ->> 'ru')), 0) = 0
     or coalesce(length(btrim(v_comment ->> 'uz')), 0) = 0 then
    raise exception 'Комментарий нужен на двух языках' using errcode = 'check_violation', hint = 'vh:comment';
  end if;
  if length(btrim(v_comment ->> 'ru')) > 300 or length(btrim(v_comment ->> 'uz')) > 300 then
    raise exception 'Комментарий — до 300 знаков' using errcode = 'check_violation', hint = 'vh:comment';
  end if;

  if jsonb_typeof(v_photos) is distinct from 'array' or jsonb_array_length(v_photos) not between 3 and 15 then
    raise exception 'В отчёте 3–15 фото' using errcode = 'check_violation', hint = 'vh:photos';
  end if;
  -- case, а не or: приведение к числу — только после проверки, что это число.
  if exists (
    select 1 from jsonb_array_elements(v_photos) as item
    where case
      when jsonb_typeof(item) <> 'object' then true
      when coalesce(item ->> 'path', '') !~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' then true
      when split_part(item ->> 'path', '/', 2) <> v_complex::text then true
      when not private.json_number_between(item -> 'width', 1, 20000, true) then true
      when not private.json_number_between(item -> 'height', 1, 20000, true) then true
      when item ? 'blur' and jsonb_typeof(item -> 'blur') not in ('string', 'null') then true
      else coalesce(length(item ->> 'blur'), 0) > 4000
    end
  ) or (
    select count(distinct item ->> 'path') <> count(*) from jsonb_array_elements(v_photos) as item
  ) then
    raise exception 'Фото не загрузились — добавьте их ещё раз' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  -- Только свои файлы: путь галереи ЖК или чужого отчёта сервер удалил бы вместе с этим отчётом.
  if exists (
    select 1 from jsonb_array_elements(v_photos) as item
    where exists (select 1 from public.media_assets m where m.path = item ->> 'path')
       or exists (select 1 from public.progress_photos p where p.path = item ->> 'path' and p.report_id is distinct from v_id)
  ) or (
    v_video is not null and (
      exists (select 1 from public.media_assets m where m.path = v_video)
      or exists (select 1 from public.progress_reports r where r.video_path = v_video and r.id is distinct from v_id)
    )
  ) then
    raise exception 'Файл уже занят — загрузите его заново' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  if v_youtube is not null and v_video is not null then
    raise exception 'Видео — или файл, или ссылка YouTube' using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  if v_youtube is not null and v_youtube !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Ссылка YouTube не распознана' using errcode = 'check_violation', hint = 'vh:youtube';
  end if;
  if v_video is not null and (v_video !~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.mp4$' or split_part(v_video, '/', 2) <> v_complex::text) then
    raise exception 'Видео не загрузилось — добавьте его ещё раз' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  if v_unit is null and exists (
    select 1 from public.progress_reports r
    where r.block_id = v_block and r.month = v_month and not r.is_unit and r.id is distinct from v_id
  ) then
    raise exception 'Отчёт по этому блоку за месяц уже есть' using errcode = 'unique_violation', hint = 'vh:duplicate';
  end if;

  if v_id is null then
    insert into public.progress_reports (
      complex_id, block_id, is_unit, unit_id, layout_id, unit_rooms, unit_area, unit_floor,
      month, comment, youtube_id, video_path, author_id
    ) values (
      v_complex, v_block, v_unit is not null, v_unit, v_layout, v_rooms, v_area, v_floor,
      v_month, jsonb_build_object('ru', btrim(v_comment ->> 'ru'), 'uz', btrim(v_comment ->> 'uz')),
      v_youtube, v_video, auth.uid()
    ) returning id into v_id;
  else
    select coalesce(jsonb_agg(p.path), '[]') into v_removed
      from public.progress_photos p
     where p.report_id = v_id
       and p.path not in (select item ->> 'path' from jsonb_array_elements(v_photos) as item);
    if v_old.video_path is not null and v_old.video_path is distinct from v_video then
      v_removed := v_removed || jsonb_build_array(v_old.video_path);
    end if;
    delete from public.progress_photos where report_id = v_id;
    update public.progress_reports set
      block_id = v_block,
      is_unit = v_unit is not null,
      unit_id = v_unit,
      layout_id = v_layout,
      unit_rooms = v_rooms,
      unit_area = v_area,
      unit_floor = v_floor,
      month = v_month,
      comment = jsonb_build_object('ru', btrim(v_comment ->> 'ru'), 'uz', btrim(v_comment ->> 'uz')),
      youtube_id = v_youtube,
      video_path = v_video,
      status = 'review',
      return_note = null
    where id = v_id;
  end if;

  insert into public.progress_photos (report_id, complex_id, path, width, height, blur, sort)
  select v_id, v_complex, item.value ->> 'path', (item.value ->> 'width')::numeric::integer, (item.value ->> 'height')::numeric::integer,
         nullif(item.value ->> 'blur', ''), item.sort
  from jsonb_array_elements(v_photos) with ordinality as item (value, sort);

  return jsonb_build_object('id', v_id, 'complex_id', v_complex, 'removed', v_removed);
end;
$$;

-- Опубликовать: менеджер и руководитель, только с отметкой «Проверено по правилу 1.2».
create function public.publish_progress_report(p_id uuid, p_checked boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Отчёты публикуют менеджер и руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  if private.locked_complex_status(v_report.complex_id) = 'archived' then
    raise exception 'ЖК в архиве — отчёт не нужен' using errcode = 'check_violation', hint = 'vh:archived';
  end if;
  if not coalesce(p_checked, false) then
    raise exception 'Сначала отметьте проверку по правилу 1.2 — без неё отчёт не публикуется'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  update public.progress_reports
     set status = 'published', published_at = now(), published_by = auth.uid()
   where id = p_id;
  return jsonb_build_object('id', p_id, 'complex_id', v_report.complex_id);
end;
$$;

-- Вернуть видеографу: с причиной; он исправит и отправит снова.
create function public.return_progress_report(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Отчёты проверяют менеджер и руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if coalesce(length(btrim(p_note)), 0) not between 1 and 300 then
    raise exception 'Напишите, что исправить (до 300 знаков)' using errcode = 'check_violation', hint = 'vh:note';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  update public.progress_reports set status = 'returned', return_note = btrim(p_note) where id = p_id;
  return jsonb_build_object('id', p_id, 'complex_id', v_report.complex_id);
end;
$$;

-- Снять с публикации — руководитель: отчёт снова на проверке (и снова через правило 1.2).
create function public.unpublish_progress_report(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head') then
    raise exception 'Снять отчёт с публикации может руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'published' then
    raise exception 'Отчёт не опубликован — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  update public.progress_reports
     set status = 'review', published_at = null, published_by = null
   where id = p_id;
  return jsonb_build_object('id', p_id, 'complex_id', v_report.complex_id);
end;
$$;

-- Удалить: руководитель — любой; видеограф — свой неопубликованный. Возвращает ЖК и файлы отчёта
-- (их удаляет сервер): {complex_id, removed}.
create function public.delete_progress_report(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
  v_removed jsonb;
begin
  if not private.has_role('head', 'videographer') then
    raise exception 'Отчёт удаляют руководитель и его автор' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found or not (private.has_role('head') or v_report.author_id = auth.uid()) then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status = 'published' and not private.has_role('head') then
    raise exception 'Опубликованный отчёт удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select coalesce(jsonb_agg(p.path order by p.sort), '[]') into v_removed
    from public.progress_photos p where p.report_id = p_id;
  if v_report.video_path is not null then
    v_removed := v_removed || jsonb_build_array(v_report.video_path);
  end if;
  delete from public.progress_reports where id = p_id;
  return jsonb_build_object('complex_id', v_report.complex_id, 'removed', v_removed);
end;
$$;

comment on table public.progress_reports is
  'Фаза 5: отчёт хода строительства — блок ЖК за месяц или видео квартиры для клиента; пишут только RPC.';
comment on table public.progress_photos is 'Фаза 5: фото отчёта (3–15), бакет media, папка ЖК.';
comment on function public.submit_progress_report(jsonb) is
  'Отправить отчёт на проверку: новый или возвращённый целиком; возвращает {id, complex_id, removed}.';
comment on function public.publish_progress_report(uuid, boolean) is
  'Опубликовать отчёт: менеджер и руководитель, только с отметкой правила 1.2.';
comment on function public.return_progress_report(uuid, text) is 'Вернуть отчёт видеографу с причиной.';
comment on function public.unpublish_progress_report(uuid) is 'Снять отчёт с публикации (руководитель).';
comment on function public.delete_progress_report(uuid) is
  'Удалить отчёт; возвращает {complex_id, removed} — файлы удаляет сервер.';

revoke all on function
  public.submit_progress_report(jsonb),
  public.publish_progress_report(uuid, boolean),
  public.return_progress_report(uuid, text),
  public.unpublish_progress_report(uuid),
  public.delete_progress_report(uuid)
from public, anon;
grant execute on function
  public.submit_progress_report(jsonb),
  public.publish_progress_report(uuid, boolean),
  public.return_progress_report(uuid, text),
  public.unpublish_progress_report(uuid),
  public.delete_progress_report(uuid)
to authenticated;

-- ─── Журнал ──────────────────────────────────────────────────────────────────────────────

-- Тело — как в 20261029080000_journal_context.sql, кроме правок фазы 5 (помечены): отчёты, удалённые
-- каскадом вместе с блоком, отдельных записей не пишут (удаление видно записью блока; их файлы остаются в
-- папке ЖК до удаления ЖК из архива), и снятая связь с удалённой квартирой — не правка.
create or replace function private.write_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  row_data jsonb := coalesce(new_row, old_row);
  changes jsonb;
  layout_pair jsonb;
  block_name text;
  block_currency public.currency;
begin
  if current_setting('vodiy.skip_audit', true) = 'on' then
    return null;
  end if;
  -- Полировка 3: и переносы сроков — их убирает каскад удаления блока (помечено).
  if tg_op = 'DELETE' and tg_table_name in ('layouts', 'units', 'deadline_changes', 'progress_reports') and not exists (
    select 1 from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid
  ) then
    return null;
  end if;
  -- Файл чертежа виден в журнале через планировку («Чертёж · изменено», удаление планировки или
  -- блока); отдельные «Фото · добавлено / удалено» на каждый чертёж — шум и путают с галереей.
  -- Фаза 4: картинка плана этажа — так же, план виден в журнале своей записью.
  if tg_table_name = 'media_assets' and row_data ->> 'kind' in ('drawing', 'floor_plan') then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    -- Порядок планировок считается из комнат и площади (save_block_layouts) — не правка человека.
    select coalesce(jsonb_object_agg(field.key, jsonb_build_array(old_row -> field.key, field.value)), '{}')
      into changes
      from jsonb_each(new_row) as field
      where field.value is distinct from old_row -> field.key
        and field.key not in ('updated_at', 'updated_by')
        and not (tg_table_name = 'layouts' and field.key = 'sort');
    if changes = '{}'::jsonb then
      return null;
    end if;
    -- Фаза 5: квартиру или планировку удалили — отчёт теряет только связь (снимок остаётся), не правка человека.
    if tg_table_name = 'progress_reports' and changes - 'unit_id' - 'layout_id' = '{}'::jsonb then
      return null;
    end if;
    -- Подпись правки переживает удаление строки: журнал собирает «Блок A · 2-комн. · 64,5 м²»
    -- из записи. Скаляры — контекст, а не изменения (журнал показывает только пары [было, стало]).
    if tg_table_name = 'layouts' then
      changes := jsonb_build_object(
        'block_id', new_row -> 'block_id', 'rooms', new_row -> 'rooms', 'area', new_row -> 'area'
      ) || changes;
    elsif tg_table_name = 'blocks' then
      changes := jsonb_build_object('name', new_row -> 'name') || changes;
    -- Фаза 4: контуры квартир плана — числом «было → стало», а не двумя массивами точек.
    elsif tg_table_name = 'floor_plans' and changes ? 'contours' then
      changes := changes - 'contours' || jsonb_build_object('contours', jsonb_build_array(
        jsonb_array_length(old_row -> 'contours'), jsonb_array_length(new_row -> 'contours')));
    elsif tg_table_name = 'units' then
      changes := jsonb_build_object('block_id', new_row -> 'block_id', 'number', new_row -> 'number') || changes;
      if changes ? 'layout_id' then
        layout_pair := jsonb_build_array(
          private.layout_label(nullif(old_row ->> 'layout_id', '')::uuid),
          private.layout_label(nullif(new_row ->> 'layout_id', '')::uuid));
        if layout_pair <> '[null, null]'::jsonb then
          changes := changes || jsonb_build_object('layout', layout_pair);
        end if;
      end if;
    -- Полировка 3: документ, тема и видео — справочником и подписью, перенос — блоком (помечено).
    elsif tg_table_name = 'complex_documents' then
      changes := jsonb_build_object('document_type_id', new_row -> 'document_type_id') || changes;
    elsif tg_table_name = 'complex_details' then
      changes := jsonb_build_object('topic_id', new_row -> 'topic_id') || changes;
    elsif tg_table_name = 'complex_videos' then
      changes := jsonb_build_object('youtube_id', new_row -> 'youtube_id', 'title', new_row -> 'title') || changes;
    elsif tg_table_name = 'deadline_changes' then
      changes := jsonb_build_object('block_id', new_row -> 'block_id') || changes;
    end if;
  else
    changes := row_data - 'created_at' - 'updated_at';
    -- Фаза 4: план этажа — с числом контуров квартир, без самих точек.
    if tg_table_name = 'floor_plans' then
      changes := changes - 'contours' || jsonb_build_object('contours', jsonb_array_length(row_data -> 'contours'));
    end if;
    -- «+ Квартира» и удаление — с подписью планировки: голый id ничего не скажет после её удаления.
    if tg_table_name = 'units' and row_data ->> 'layout_id' is not null then
      changes := changes || jsonb_build_object('layout', private.layout_label((row_data ->> 'layout_id')::uuid));
    end if;
  end if;
  -- Название блока — тоже контекстом: подпись переживает и удаление самого блока; и валюта —
  -- «350 000 000 → 360 000 000» без неё не прочитать (цена квартиры и «цена от» планировки).
  if tg_table_name in ('layouts', 'units') then
    select b.name, b.currency into block_name, block_currency
      from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid;
    changes := changes || jsonb_build_object('block_name', block_name, 'currency', block_currency);
  -- Полировка 3: перенос срока — с названием блока (помечено).
  elsif tg_table_name = 'deadline_changes' then
    select b.name into block_name from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid;
    changes := changes || jsonb_build_object('block_name', block_name);
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, developer_id, changes)
  values (
    (select auth.uid()),
    lower(tg_op)::public.audit_action,
    tg_table_name,
    coalesce(row_data ->> 'id', row_data ->> 'key', row_data ->> 'developer_id'),
    private.audit_complex_id(tg_table_name, row_data),
    private.audit_developer_id(tg_table_name, row_data),
    changes
  );
  return null;
end;
$$;
