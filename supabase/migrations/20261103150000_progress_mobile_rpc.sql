-- Проект-2, фаза E (PLAN §10, пп. 13, 31–38): функции кабинета мобилографа. Схема — 20261103140000.
-- Черновик и «На проверку» — одна проверка (private.progress_write): черновик сохраняется неполным,
-- «На проверку» — целиком (3–15 фото, RU и UZ). Новые файлы — только свои загрузки incoming не старше
-- суток; файл, уже бывший в отчёте, проходит (правка возвращённого руководителем, старые публичные пути).
-- Публикация — в два шага: progress_publish_files назначает адреса копий, сервер копирует файлы
-- секретным ключом, publish_progress_report проверяет копии и переключает пути. «Задания», «Медиа ЖК»,
-- уборка incoming — функциями ниже.

-- ─── Помощники ───────────────────────────────────────────────────────────────────────────

-- Дата съёмки: не в будущем и не старше 60 дней по Ташкенту; у возвращённого — и прежняя дата.
create function private.progress_shot_ok(p_shot date, p_old date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    p_shot = p_old or p_shot between private.tashkent_today() - 60 and private.tashkent_today(),
    false
  )
$$;

-- Файл отчёта: уже в этом отчёте — да; иначе своя свежая загрузка incoming нужного вида и размера,
-- не занятая другим отчётом. Публичные пути не из отчёта (галерея, чужие) — нет.
create function private.progress_file_ok(p_path text, p_complex uuid, p_report uuid, p_ext text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_path is null then false
    when p_report is not null and (
      exists (select 1 from public.progress_photos p where p.report_id = p_report and p.path = p_path)
      or exists (select 1 from public.progress_reports r where r.id = p_report and r.video_path = p_path)
    ) then true
    when p_path !~ ('^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.' || p_ext || '$') then false
    when split_part(p_path, '/', 1) <> coalesce((select auth.uid())::text, '') then false
    when split_part(p_path, '/', 2) <> p_complex::text then false
    when exists (select 1 from public.progress_photos p where p.path = p_path)
      or exists (select 1 from public.progress_reports r where r.video_path = p_path) then false
    else exists (
      select 1 from storage.objects o
      where o.bucket_id = 'incoming' and o.name = p_path
        and o.created_at > now() - interval '24 hours'
        and coalesce(o.metadata ->> 'mimetype', '') = case p_ext when 'jpg' then 'image/jpeg' else 'video/mp4' end
        and coalesce((o.metadata ->> 'size')::bigint, 0) <= case p_ext when 'jpg' then 15728640 else 52428800 end
    )
  end
$$;

-- Подпись отчёта для уведомлений: ЖК, блок, квартира, дата съёмки, автор.
create function private.progress_notice(r public.progress_reports)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'complex', (select c.name ->> 'ru' from public.complexes c where c.id = r.complex_id),
    'block', (select b.name from public.blocks b where b.id = r.block_id),
    'unit', (select u.number from public.units u where u.id = r.unit_id),
    'is_unit', r.is_unit,
    'shot_on', r.shot_on,
    'author', (select p.full_name from public.profiles p where p.id = r.author_id)
  )
$$;

revoke all on function
  private.progress_shot_ok(date, date),
  private.progress_file_ok(text, uuid, uuid, text),
  private.progress_notice(public.progress_reports)
from public, anon;
grant execute on function
  private.progress_shot_ok(date, date),
  private.progress_file_ok(text, uuid, uuid, text),
  private.progress_notice(public.progress_reports)
to authenticated, service_role;

-- ─── Сохранить черновик / отправить на проверку ──────────────────────────────────────────
-- p_report: {id?, block_id, unit_id?, shot_on, comment {ru, uz}, youtube_id?, video_path?,
--  photos [{path, width, height, blur?}] по порядку}. p_submit — «На проверку».
-- Возвращает {id, complex_id, status, removed, notice}: removed — файлы, убранные из отчёта (удаляет сервер).
create function private.progress_write(p_report jsonb, p_submit boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_block uuid;
  v_unit uuid;
  v_shot date;
  v_month date;
  v_complex uuid;
  v_unit_status public.unit_status;
  v_layout uuid;
  v_rooms smallint;
  v_area numeric;
  v_floor smallint;
  v_photos jsonb := coalesce(p_report -> 'photos', '[]'::jsonb);
  v_youtube text := nullif(btrim(p_report ->> 'youtube_id'), '');
  v_video text := nullif(btrim(p_report ->> 'video_path'), '');
  v_comment jsonb := coalesce(p_report -> 'comment', '{}'::jsonb);
  v_ru text;
  v_uz text;
  v_old public.progress_reports;
  v_status public.progress_status;
  v_removed jsonb := '[]';
  v_quiet boolean;
  v_row public.progress_reports;
begin
  if not private.has_role('head', 'mobilographer') then
    raise exception 'Отчёты ведут мобилограф и руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  begin
    v_id := nullif(p_report ->> 'id', '')::uuid;
    v_block := nullif(p_report ->> 'block_id', '')::uuid;
    v_unit := nullif(p_report ->> 'unit_id', '')::uuid;
    v_shot := nullif(p_report ->> 'shot_on', '')::date;
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

  -- Правка: черновик — только автор (другим его не видно); возвращённый — автор или руководитель.
  if v_id is not null then
    select * into v_old from public.progress_reports r where r.id = v_id for update;
    if not found
       or (v_old.status = 'draft' and v_old.author_id is distinct from auth.uid())
       or (v_old.status = 'returned' and not (private.has_role('head') or v_old.author_id = auth.uid()))
       or (v_old.status not in ('draft', 'returned') and not (private.has_role('head') or v_old.author_id = auth.uid())) then
      raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    if v_old.status not in ('draft', 'returned') then
      raise exception 'Отчёт уже на проверке или опубликован — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
    end if;
    if v_old.complex_id <> v_complex then
      raise exception 'Отчёт заполнен неверно — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
    end if;
  elsif not p_submit and (
    select count(*) from public.progress_reports r where r.author_id = auth.uid() and r.status = 'draft'
  ) >= 30 then
    raise exception 'Черновиков уже 30 — отправьте или удалите старые' using errcode = 'check_violation', hint = 'vh:limit';
  end if;
  -- Потолок «на проверке» — и чат тревог руководителя не заливает поток отчётов.
  if p_submit and (
    select count(*) from public.progress_reports r
    where r.author_id = auth.uid() and r.status = 'review' and r.id is distinct from v_id
  ) >= 30 then
    raise exception 'На проверке уже 30 отчётов — дождитесь руководителя' using errcode = 'check_violation', hint = 'vh:limit';
  end if;

  if not private.progress_shot_ok(v_shot, case when v_old.status = 'returned' then v_old.shot_on end) then
    raise exception 'Дата съёмки — сегодня или за последние 60 дней' using errcode = 'check_violation', hint = 'vh:shot_date';
  end if;
  v_month := date_trunc('month', v_shot)::date;

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

  if jsonb_typeof(v_comment) <> 'object'
     or jsonb_typeof(coalesce(v_comment -> 'ru', '""')) <> 'string'
     or jsonb_typeof(coalesce(v_comment -> 'uz', '""')) <> 'string' then
    raise exception 'Отчёт заполнен неверно — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  v_ru := btrim(coalesce(v_comment ->> 'ru', ''));
  v_uz := btrim(coalesce(v_comment ->> 'uz', ''));
  if length(v_ru) > 300 or length(v_uz) > 300 then
    raise exception 'Комментарий — до 300 знаков' using errcode = 'check_violation', hint = 'vh:comment';
  end if;
  if p_submit and (v_ru = '' or v_uz = '') then
    raise exception 'Комментарий нужен на двух языках' using errcode = 'check_violation', hint = 'vh:comment';
  end if;

  if jsonb_typeof(v_photos) <> 'array'
     or jsonb_array_length(v_photos) > 15
     or (p_submit and jsonb_array_length(v_photos) < 3) then
    raise exception 'В отчёте 3–15 фото' using errcode = 'check_violation', hint = 'vh:photos';
  end if;
  -- case, а не or: приведение к числу — только после проверки, что это число.
  if exists (
    select 1 from jsonb_array_elements(v_photos) as item
    where case
      when jsonb_typeof(item) <> 'object' then true
      when jsonb_typeof(item -> 'path') is distinct from 'string' then true
      when not private.json_number_between(item -> 'width', 1, 20000, true) then true
      when not private.json_number_between(item -> 'height', 1, 20000, true) then true
      when item ? 'blur' and jsonb_typeof(item -> 'blur') not in ('string', 'null') then true
      when coalesce(length(item ->> 'blur'), 0) > 4000 then true
      else not private.progress_file_ok(item ->> 'path', v_complex, v_id, 'jpg')
    end
  ) or (
    select count(distinct item ->> 'path') <> count(*) from jsonb_array_elements(v_photos) as item
  ) then
    raise exception 'Фото не загрузились — добавьте их ещё раз' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  if v_youtube is not null and v_video is not null then
    raise exception 'Видео — или файл, или ссылка YouTube' using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  if v_youtube is not null and v_youtube !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Ссылка YouTube не распознана' using errcode = 'check_violation', hint = 'vh:youtube';
  end if;
  if v_video is not null and not private.progress_file_ok(v_video, v_complex, v_id, 'mp4') then
    raise exception 'Видео не загрузилось — добавьте его ещё раз' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  if (p_submit or v_old.status = 'returned') and v_unit is null and exists (
    select 1 from public.progress_reports r
    where r.block_id = v_block and r.month = v_month and not r.is_unit and r.status <> 'draft'
      and r.id is distinct from v_id
  ) then
    raise exception 'Отчёт по этому блоку за месяц уже есть' using errcode = 'unique_violation', hint = 'vh:duplicate';
  end if;

  v_status := case
    when p_submit then 'review'::public.progress_status
    when v_id is null then 'draft'::public.progress_status
    else v_old.status
  end;
  -- Черновик видит только автор — в журнал он не пишется; отправка — одна запись «Черновик → На проверке».
  v_quiet := v_status = 'draft';

  if v_quiet then
    perform set_config('vodiy.skip_audit', 'on', true);
  end if;
  if v_id is null then
    insert into public.progress_reports (
      complex_id, block_id, is_unit, unit_id, layout_id, unit_rooms, unit_area, unit_floor,
      month, shot_on, comment, youtube_id, video_path, author_id, status
    ) values (
      v_complex, v_block, v_unit is not null, v_unit, v_layout, v_rooms, v_area, v_floor,
      v_month, v_shot, jsonb_build_object('ru', v_ru, 'uz', v_uz), v_youtube, v_video, auth.uid(), v_status
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
      shot_on = v_shot,
      comment = jsonb_build_object('ru', v_ru, 'uz', v_uz),
      youtube_id = v_youtube,
      video_path = v_video,
      status = v_status,
      return_note = case when v_status = 'returned' then return_note end,
      -- Очередь «Ждут проверки» — по моменту отправки, а не первого черновика.
      created_at = case when p_submit and v_old.status = 'draft' then now() else created_at end
    where id = v_id;
  end if;
  if v_quiet then
    perform set_config('vodiy.skip_audit', 'off', true);
  end if;

  insert into public.progress_photos (report_id, complex_id, path, width, height, blur, sort)
  select v_id, v_complex, item.value ->> 'path', (item.value ->> 'width')::numeric::integer,
         (item.value ->> 'height')::numeric::integer, nullif(item.value ->> 'blur', ''), item.sort
  from jsonb_array_elements(v_photos) with ordinality as item (value, sort);

  select * into v_row from public.progress_reports r where r.id = v_id;
  return jsonb_build_object(
    'id', v_id, 'complex_id', v_complex, 'status', v_status, 'removed', v_removed,
    'notice', private.progress_notice(v_row)
  );
end;
$$;

revoke all on function private.progress_write(jsonb, boolean) from public, anon;

create function public.save_progress_draft(p_report jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.progress_write(p_report, false)
$$;

create or replace function public.submit_progress_report(p_report jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.progress_write(p_report, true)
$$;

-- ─── Удалить ─────────────────────────────────────────────────────────────────────────────
-- Автор — свой черновик или возвращённый; руководитель — любой, кроме чужого черновика (его не видно).
-- Возвращает {complex_id, removed}: файлы отчёта и назначенные копии (их удаляет сервер).
create or replace function public.delete_progress_report(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
  v_removed jsonb;
begin
  if not private.has_role('head', 'mobilographer') then
    raise exception 'Отчёт удаляют руководитель и его автор' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found
     or (v_report.status = 'draft' and v_report.author_id is distinct from auth.uid())
     or not (private.has_role('head') or v_report.author_id = auth.uid()) then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status not in ('draft', 'returned') and not private.has_role('head') then
    raise exception 'Отчёт на проверке или опубликованный удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select coalesce(jsonb_agg(f.path), '[]') into v_removed
    from (
      select p.path from public.progress_photos p where p.report_id = p_id
      union all
      select p.publish_path from public.progress_photos p where p.report_id = p_id and p.publish_path is not null
    ) f;
  if v_report.video_path is not null then
    v_removed := v_removed || jsonb_build_array(v_report.video_path);
  end if;
  if v_report.video_publish_path is not null then
    v_removed := v_removed || jsonb_build_array(v_report.video_publish_path);
  end if;
  if v_report.status = 'draft' then
    perform set_config('vodiy.skip_audit', 'on', true);
  end if;
  delete from public.progress_reports where id = p_id;
  perform set_config('vodiy.skip_audit', 'off', true);
  return jsonb_build_object('complex_id', v_report.complex_id, 'removed', v_removed);
end;
$$;

-- ─── Публикация (руководитель): адреса копий → копии сервером → переключение путей ───────
-- Проверки — до копирования. p_version — версия отчёта (updated_at), которую видел руководитель:
-- «Убрать кадр» или правка после открытия ящика → vh:stale. Возвращает {version, files}: version —
-- для publish_progress_report, files — что скопировать из incoming.
create function public.progress_publish_files(p_id uuid, p_checked boolean, p_version timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
begin
  if not private.has_role('head') then
    raise exception 'Отчёты публикует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' or v_report.updated_at is distinct from p_version then
    raise exception 'Отчёт изменился — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  if private.locked_complex_status(v_report.complex_id) = 'archived' then
    raise exception 'ЖК в архиве — отчёт не нужен' using errcode = 'check_violation', hint = 'vh:archived';
  end if;
  if not coalesce(p_checked, false) then
    raise exception 'Сначала отметьте проверку по правилу 1.2 — без неё отчёт не публикуется'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;

  update public.progress_photos p
     set publish_path = 'complexes/' || p.complex_id || '/' || gen_random_uuid() || '.jpg'
   where p.report_id = p_id and p.path not like 'complexes/%' and p.publish_path is null;
  if v_report.video_path is not null and v_report.video_path not like 'complexes/%' and v_report.video_publish_path is null then
    perform set_config('vodiy.skip_audit', 'on', true);
    update public.progress_reports
       set video_publish_path = 'complexes/' || complex_id || '/' || gen_random_uuid() || '.mp4'
     where id = p_id
     returning * into v_report;
    perform set_config('vodiy.skip_audit', 'off', true);
  end if;

  return jsonb_build_object(
    'version', v_report.updated_at,
    'files', (
      select coalesce(jsonb_agg(f.item), '[]'::jsonb) from (
        select jsonb_build_object('from', p.path, 'to', p.publish_path, 'bucket', 'media') as item
          from public.progress_photos p where p.report_id = p_id and p.publish_path is not null
        union all
        select jsonb_build_object('from', v_report.video_path, 'to', v_report.video_publish_path, 'bucket', 'progress-video')
          where v_report.video_publish_path is not null
      ) f
    )
  );
end;
$$;

drop function public.publish_progress_report(uuid, boolean);

-- Опубликовать: копии на месте (сервер скопировал) → пути отчёта становятся публичными.
-- Возвращает {id, complex_id, author_id, is_unit, slug, incoming, notice}: incoming — старые пути
-- (их удаляет сервер).
create function public.publish_progress_report(p_id uuid, p_checked boolean default false, p_version timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
  v_incoming jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Отчёты публикует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_report from public.progress_reports r where r.id = p_id for update;
  if not found then
    raise exception 'Отчёт не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if v_report.status <> 'review' or v_report.updated_at is distinct from p_version then
    raise exception 'Отчёт изменился — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  if private.locked_complex_status(v_report.complex_id) = 'archived' then
    raise exception 'ЖК в архиве — отчёт не нужен' using errcode = 'check_violation', hint = 'vh:archived';
  end if;
  if not coalesce(p_checked, false) then
    raise exception 'Сначала отметьте проверку по правилу 1.2 — без неё отчёт не публикуется'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  -- У каждого файла incoming — адрес копии, и копия на месте; копию положил сервер (без владельца):
  -- файл, подложенный сотрудником по известному адресу, не публикуется (ревью фазы E).
  if exists (
    select 1 from public.progress_photos p
    where p.report_id = p_id and p.path not like 'complexes/%'
      and (p.publish_path is null or not exists (
        select 1 from storage.objects o where o.bucket_id = 'media' and o.name = p.publish_path and o.owner is null))
  ) or (
    v_report.video_path is not null and v_report.video_path not like 'complexes/%'
    and (v_report.video_publish_path is null or not exists (
      select 1 from storage.objects o
      where o.bucket_id = 'progress-video' and o.name = v_report.video_publish_path and o.owner is null))
  ) then
    raise exception 'Файлы отчёта не скопировались — опубликуйте ещё раз' using errcode = 'check_violation', hint = 'vh:files';
  end if;

  select coalesce(jsonb_agg(p.path), '[]') into v_incoming
    from public.progress_photos p where p.report_id = p_id and p.publish_path is not null;
  if v_report.video_publish_path is not null then
    v_incoming := v_incoming || jsonb_build_array(v_report.video_path);
  end if;

  update public.progress_photos
     set path = publish_path, publish_path = null
   where report_id = p_id and publish_path is not null;
  if exists (select 1 from public.progress_photos p where p.report_id = p_id and p.path not like 'complexes/%') then
    raise exception 'Файлы отчёта не скопировались — опубликуйте ещё раз' using errcode = 'check_violation', hint = 'vh:files';
  end if;
  update public.progress_reports
     set video_path = coalesce(video_publish_path, video_path),
         video_publish_path = null,
         status = 'published', published_at = now(), published_by = auth.uid()
   where id = p_id
   returning * into v_report;

  return jsonb_build_object(
    'id', p_id, 'complex_id', v_report.complex_id, 'author_id', v_report.author_id,
    'is_unit', v_report.is_unit,
    'slug', (select c.slug from public.complexes c where c.id = v_report.complex_id),
    'incoming', v_incoming, 'notice', private.progress_notice(v_report)
  );
end;
$$;

-- Вернуть автору с причиной; назначенные копии (если публикация сорвалась) — в removed.
create or replace function public.return_progress_report(p_id uuid, p_note text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.progress_reports;
  v_removed jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Отчёты проверяет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
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
  select coalesce(jsonb_agg(p.publish_path), '[]') into v_removed
    from public.progress_photos p where p.report_id = p_id and p.publish_path is not null;
  if v_report.video_publish_path is not null then
    v_removed := v_removed || jsonb_build_array(v_report.video_publish_path);
  end if;
  update public.progress_photos set publish_path = null where report_id = p_id and publish_path is not null;
  update public.progress_reports
     set status = 'returned', return_note = btrim(p_note), video_publish_path = null
   where id = p_id
   returning * into v_report;
  return jsonb_build_object(
    'id', p_id, 'complex_id', v_report.complex_id, 'author_id', v_report.author_id,
    'removed', v_removed, 'notice', private.progress_notice(v_report)
  );
end;
$$;

-- «Убрать кадр» (п. 38): руководитель, отчёт на проверке, остаётся не меньше 3 фото.
create function public.remove_progress_photo(p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_photo public.progress_photos;
  v_report public.progress_reports;
  v_count integer;
begin
  if not private.has_role('head') then
    raise exception 'Кадр убирает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into v_photo from public.progress_photos p where p.id = p_photo;
  if not found then
    raise exception 'Кадр не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  select * into v_report from public.progress_reports r where r.id = v_photo.report_id for update;
  if v_report.status <> 'review' then
    raise exception 'Отчёт уже опубликован или возвращён — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  select count(*) into v_count from public.progress_photos p where p.report_id = v_report.id;
  if v_count <= 3 then
    raise exception 'В отчёте должно остаться не меньше 3 фото' using errcode = 'check_violation', hint = 'vh:frames';
  end if;
  delete from public.progress_photos where id = p_photo and report_id = v_report.id;
  if not found then
    raise exception 'Кадр уже убран — обновите страницу' using errcode = 'check_violation', hint = 'vh:stale';
  end if;
  -- Новая версия отчёта: публикация из ящика, открытого до правки, — vh:stale. Журнал — строкой ниже.
  perform set_config('vodiy.skip_audit', 'on', true);
  update public.progress_reports set updated_at = now() where id = v_report.id;
  perform set_config('vodiy.skip_audit', 'off', true);
  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, developer_id, changes)
  values (
    auth.uid(), 'update', 'progress_reports', v_report.id::text, v_report.complex_id,
    (select c.developer_id from public.complexes c where c.id = v_report.complex_id),
    jsonb_build_object('photos', jsonb_build_array(v_count, v_count - 1))
  );
  return jsonb_build_object(
    'report_id', v_report.id, 'complex_id', v_report.complex_id,
    'removed', jsonb_build_array(v_photo.path) || case
      when v_photo.publish_path is null then '[]'::jsonb else jsonb_build_array(v_photo.publish_path) end
  );
end;
$$;

-- ─── Сайт и обзор: дата съёмки (п. 33) ───────────────────────────────────────────────────
-- Тело — как в 20261029130000_progress_site_unit_flag.sql, кроме shot_at.
create or replace function private.site_progress_report(r public.progress_reports)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'is_unit', r.is_unit,
    'month', r.month,
    -- Фаза E: «Снято дд.мм.гггг» — дата съёмки.
    'shot_at', r.shot_on,
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

-- Тело — как в 20261101120000_publication_rule_v2.sql, кроме порядка истории (по дате съёмки).
create or replace function public.site_unit_video(p_id uuid)
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
    'layout_id', (
      select lc.layout_id from private.layout_completeness lc
      where lc.layout_id = r.layout_id and lc.is_complete),
    'rooms', r.unit_rooms,
    'area', r.unit_area,
    'floor', r.unit_floor,
    'history', (
      select coalesce(jsonb_agg(private.site_progress_report(h) order by h.month desc, h.shot_on desc, h.created_at desc), '[]'::jsonb)
      from public.progress_reports h
      where h.id in (
        select x.id from public.progress_reports x
        where x.status = 'published' and x.id <> r.id
          and ((x.is_unit and r.unit_id is not null and x.unit_id = r.unit_id) or (not x.is_unit and x.block_id = r.block_id))
        order by x.month desc, x.shot_on desc, x.created_at desc
        limit 6
      ))
  )
  from public.progress_reports r
  where r.id = p_id and r.status = 'published' and r.is_unit and private.can_see_complex(r.complex_id)
$$;

-- Тело — как в 20261029140000_progress_overview.sql; фаза E: только руководитель и менеджер, «снято» — дата съёмки.
create or replace function public.progress_overview()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.has_role('head', 'manager') then jsonb_build_object(
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
          'id', r.id, 'is_unit', r.is_unit, 'month', r.month, 'shot_at', r.shot_on,
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

-- ─── «Задания» (п. 34): строящиеся блоки × текущий месяц ─────────────────────────────────
-- Статус блока: отчёт месяца не-черновик (он один), иначе свой черновик, иначе none. report_id — только
-- у своего отчёта. left — блоки без отчёта на проверке или опубликованного.
create function public.progress_tasks()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cur as (
    select date_trunc('month', private.tashkent_today())::date as m
  ),
  blk as (
    select b.id, b.complex_id, b.name, b.sort,
      coalesce(
        (select r from public.progress_reports r, cur
          where r.block_id = b.id and not r.is_unit and r.month = cur.m and r.status <> 'draft' limit 1),
        (select r from public.progress_reports r, cur
          where r.block_id = b.id and not r.is_unit and r.month = cur.m and r.status = 'draft'
            and r.author_id = auth.uid()
          order by r.updated_at desc limit 1)
      ) as rep
    from public.blocks b
    join public.complexes c on c.id = b.complex_id
    where b.build_status = 'building' and c.status <> 'archived'
  ),
  marks as (
    select b.*,
      coalesce((b.rep).status::text, 'none') as state,
      (b.rep).author_id = auth.uid() as mine
    from blk b
  ),
  grouped as (
    select c.id, c.name ->> 'ru' as name,
      count(*) as total,
      count(*) filter (where r.state not in ('review', 'published')) as left_count,
      jsonb_agg(jsonb_build_object(
        'id', r.id, 'name', r.name, 'status', r.state,
        'report_id', case when r.mine then (r.rep).id end,
        'mine', coalesce(r.mine, false),
        'shot_on', (r.rep).shot_on
      ) order by r.sort, r.name) as blocks
    from marks r join public.complexes c on c.id = r.complex_id
    group by c.id
  )
  select case when private.has_role('mobilographer') then jsonb_build_object(
    'month', (select m from cur),
    'today', private.tashkent_today(),
    'total', coalesce((select sum(total) from grouped), 0),
    'left', coalesce((select sum(left_count) from grouped), 0),
    'complexes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', x.id, 'name', x.name, 'total', x.total, 'left', x.left_count, 'blocks', x.blocks) order by x.name)
      from grouped x), '[]'::jsonb)
  ) end
$$;

-- ─── «Медиа ЖК» (п. 35): опубликованные отчёты по месяцам, без данных застройщика ────────
create function public.progress_media_complexes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name ->> 'ru', 'address', c.address ->> 'ru', 'lat', c.lat, 'lng', c.lng,
      'building', exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status = 'building'),
      'reports', (
        select count(*) from public.progress_reports r
        where r.complex_id = c.id and r.status = 'published'
          and r.month >= (date_trunc('month', private.tashkent_today()) - interval '23 months')::date),
      'last_month', (select max(r.month) from public.progress_reports r where r.complex_id = c.id and r.status = 'published')
    ) order by c.name ->> 'ru')
    from public.complexes c
    where c.status <> 'archived'
  ), '[]'::jsonb) end
$$;

create function public.progress_media(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_staff() then (
    select jsonb_build_object(
      'id', c.id, 'name', c.name ->> 'ru', 'address', c.address ->> 'ru', 'landmark', c.landmark ->> 'ru',
      'lat', c.lat, 'lng', c.lng,
      'months', coalesce((
        select jsonb_agg(jsonb_build_object('month', m.month, 'reports', m.reports) order by m.month desc)
        from (
          select r.month, jsonb_agg(jsonb_build_object(
            'id', r.id, 'is_unit', r.is_unit,
            'block', (select b.name from public.blocks b where b.id = r.block_id),
            'shot_on', r.shot_on, 'youtube_id', r.youtube_id, 'video_path', r.video_path,
            'photos', (
              select coalesce(jsonb_agg(jsonb_build_object('path', p.path, 'width', p.width, 'height', p.height)
                order by p.sort), '[]'::jsonb)
              from public.progress_photos p where p.report_id = r.id)
          ) order by r.shot_on desc, r.created_at desc) as reports
          from public.progress_reports r
          where r.complex_id = c.id and r.status = 'published'
            and r.month >= (date_trunc('month', private.tashkent_today()) - interval '23 months')::date
          group by r.month
        ) m
      ), '[]'::jsonb)
    )
    from public.complexes c
    where c.id = p_complex and c.status <> 'archived'
  ) end
$$;

-- ─── Уборка incoming (сервер, секретный ключ) ────────────────────────────────────────────
-- Файлы старше 48 часов без ссылки из отчёта: в отчёт новый файл берётся только моложе суток.
create function public.progress_incoming_orphans(p_limit integer default 500)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(o.name), '[]'::jsonb)
  from (
    select o.name from storage.objects o
    where o.bucket_id = 'incoming'
      and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|mp4)$'
      and o.created_at < now() - interval '48 hours'
      and not exists (select 1 from public.progress_photos p where p.path = o.name)
      and not exists (select 1 from public.progress_reports r where r.video_path = o.name)
    order by o.created_at
    limit least(greatest(coalesce(p_limit, 500), 1), 1000)
  ) o
$$;

-- Какие из путей ещё упомянуты (отчёты, адреса копий, галерея) — сервер не удалит их при откате копий.
create function public.progress_public_refs(p_paths text[])
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(x.path), '{}')
  from unnest(p_paths) as x(path)
  where exists (select 1 from public.progress_photos p where p.path = x.path or p.publish_path = x.path)
     or exists (select 1 from public.progress_reports r where r.video_path = x.path or r.video_publish_path = x.path)
     or exists (select 1 from public.media_assets m where m.path = x.path)
$$;

comment on function public.save_progress_draft(jsonb) is
  'Фаза E: сохранить черновик отчёта (неполный); возвращает {id, complex_id, status, removed, notice}.';
comment on function public.submit_progress_report(jsonb) is
  'Отправить отчёт на проверку (новый, черновик или возвращённый); возвращает {id, complex_id, status, removed, notice}.';
comment on function public.progress_publish_files(uuid, boolean, timestamptz) is
  'Фаза E: назначить адреса копий файлов incoming перед публикацией (руководитель).';
comment on function public.publish_progress_report(uuid, boolean, timestamptz) is
  'Опубликовать отчёт: руководитель, отметка правила 1.2, копии файлов на месте.';
comment on function public.remove_progress_photo(uuid) is 'Фаза E: «Убрать кадр» отчёта на проверке (руководитель).';
comment on function public.progress_tasks() is 'Фаза E: «Задания» мобилографа на текущий месяц.';
comment on function public.progress_media_complexes() is 'Фаза E: «Медиа ЖК» — список ЖК.';
comment on function public.progress_media(uuid) is 'Фаза E: «Медиа ЖК» — опубликованные отчёты ЖК по месяцам.';
comment on function public.progress_incoming_orphans(integer) is 'Фаза E: файлы incoming без отчёта старше 48 ч (сервер).';
comment on function public.progress_public_refs(text[]) is 'Фаза E: какие пути ещё упомянуты (сервер).';

revoke all on function
  public.save_progress_draft(jsonb),
  public.progress_publish_files(uuid, boolean, timestamptz),
  public.publish_progress_report(uuid, boolean, timestamptz),
  public.remove_progress_photo(uuid),
  public.progress_tasks(),
  public.progress_media_complexes(),
  public.progress_media(uuid),
  public.progress_incoming_orphans(integer),
  public.progress_public_refs(text[])
from public, anon;
grant execute on function
  public.save_progress_draft(jsonb),
  public.progress_publish_files(uuid, boolean, timestamptz),
  public.publish_progress_report(uuid, boolean, timestamptz),
  public.remove_progress_photo(uuid),
  public.progress_tasks(),
  public.progress_media_complexes(),
  public.progress_media(uuid)
to authenticated;
revoke all on function
  public.progress_incoming_orphans(integer),
  public.progress_public_refs(text[])
from authenticated;
grant execute on function
  public.progress_incoming_orphans(integer),
  public.progress_public_refs(text[])
to service_role;
