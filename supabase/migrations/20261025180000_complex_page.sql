-- Фаза 3 · шаг 3.5: страница ЖК (PLAN §6 «ф.3а», решения фазы 3 Ф4, Ф5 и «Вижу проблему»).
-- Документы, видео, детали проекта и переносы сроков — таблицами ЖК; «Удобство локации» — проверка
-- формата; «Разрешение» и «Земля» в «Проверено Vodiy House» — из документов ЖК (даты переносятся,
-- колонки уходят: одна правда вместо двух); черновики «?» к документам и отделке; страница ЖК одним
-- запросом — site_complex(slug), каталог — с проверками из документов.

-- ─── Документы ЖК (ТЗ 7.8) ───────────────────────────────────────────────────────────────

create table public.complex_documents (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  document_type_id smallint not null references public.document_types (id) on delete restrict,
  -- Хранятся только проверенные: документ со значением «нет» на сайт не выводится вовсе (ТЗ 7.8).
  checked_on date not null check (checked_on between date '2000-01-01' and date '2100-12-31'),
  unique (complex_id, document_type_id)
);

create index complex_documents_type_idx on public.complex_documents (document_type_id);

-- Даты проверки разрешения и земли (И1 B) становятся документами ЖК. Журнал включается после:
-- перенос — не действие сотрудника.
insert into public.complex_documents (complex_id, document_type_id, checked_on)
select c.id, t.id, moved.checked_on
from public.complexes c
cross join lateral (
  values ('permit', c.permit_checked_at), ('land', c.land_checked_at)
) as moved (slug, checked_on)
join public.document_types t on t.slug = moved.slug
where moved.checked_on is not null;

alter table public.complexes drop column permit_checked_at, drop column land_checked_at;

-- Дата проверки документа ЖК по адресу типа («permit», «land»); null — не проверен.
create function private.complex_document_on(p_complex uuid, p_type text)
returns date
language sql
stable
set search_path = ''
as $$
  select d.checked_on
  from public.complex_documents d
  join public.document_types t on t.id = d.document_type_id
  where d.complex_id = p_complex and t.slug = p_type
$$;

revoke all on function private.complex_document_on(uuid, text) from public;

-- ─── Видеообзор (ТЗ 7.5) и детали проекта (ТЗ 7.7) ───────────────────────────────────────

create table public.complex_videos (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  -- Код ролика YouTube: плеер грузится только по клику на превью (ТЗ 7.5).
  youtube_id text not null check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  title public.i18n_text check (length(title ->> 'ru') <= 80 and length(title ->> 'uz') <= 80),
  sort integer not null default 0,
  unique (complex_id, youtube_id)
);

create table public.complex_details (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  topic_id smallint not null references public.detail_topics (id) on delete restrict,
  -- Карточка показывает начало (~300 знаков), «Читать далее» — весь текст.
  text public.i18n_text not null
    check (length(text ->> 'ru') <= 2000 and length(text ->> 'uz') <= 2000),
  -- Фото карточки — из галереи ЖК: на нём уже стоит отметка правила 1.2.
  photo_id uuid references public.media_assets (id) on delete set null,
  unique (complex_id, topic_id)
);

create index complex_details_topic_idx on public.complex_details (topic_id);
create index complex_details_photo_idx on public.complex_details (photo_id);

-- ─── Переносы сроков (ТЗ 7.3в: «перенесён с 2 кв. 2027», «История сроков») ───────────────
-- Пишет «Сохранить» на «Блоках», когда руководитель отметил новый срок как перенос; только
-- подтверждённые договором или письмом застройщика (ТЗ 18). complex_id — для журнала ЖК: запись
-- переживает удаление блока каскадом с понятным ЖК.

create table public.deadline_changes (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  from_year smallint not null check (from_year between 2000 and 2100),
  from_quarter smallint not null check (from_quarter between 1 and 4),
  to_year smallint not null check (to_year between 2000 and 2100),
  to_quarter smallint not null check (to_quarter between 1 and 4),
  changed_on date not null default current_date,
  created_at timestamptz not null default now(),
  check ((from_year, from_quarter) <> (to_year, to_quarter))
);

create index deadline_changes_block_idx on public.deadline_changes (block_id, changed_on);
create index deadline_changes_complex_idx on public.deadline_changes (complex_id);

-- ─── Права (PLAN §5): сайт — у опубликованных ЖК, сотрудники — все, правит руководитель ──

alter table public.complex_documents enable row level security;
alter table public.complex_videos enable row level security;
alter table public.complex_details enable row level security;
alter table public.deadline_changes enable row level security;

revoke all on public.complex_documents, public.complex_videos, public.complex_details,
  public.deadline_changes
from anon, authenticated;
grant select on public.complex_documents, public.complex_videos, public.complex_details,
  public.deadline_changes
to anon, authenticated;
grant insert, update, delete on public.complex_documents, public.complex_videos,
  public.complex_details, public.deadline_changes
to authenticated;

do $$
declare
  content_table text;
begin
  foreach content_table in array array[
    'complex_documents', 'complex_videos', 'complex_details', 'deadline_changes'
  ] loop
    execute format(
      'create policy "%s: сайт — у опубликованных ЖК, сотрудники — все" on public.%I
         for select to anon, authenticated
         using (private.is_public_complex(complex_id) or (select private.is_staff()))',
      content_table, content_table);
    execute format(
      'create policy "%s: добавляет руководитель" on public.%I for insert to authenticated
         with check ((select private.has_role(''head'')))', content_table, content_table);
    execute format(
      'create policy "%s: правит руководитель" on public.%I for update to authenticated
         using ((select private.has_role(''head''))) with check ((select private.has_role(''head'')))',
      content_table, content_table);
    execute format(
      'create policy "%s: удаляет руководитель" on public.%I for delete to authenticated
         using ((select private.has_role(''head'')))', content_table, content_table);
    execute format(
      'create trigger %s_audit after insert or update or delete on public.%I
         for each row execute function private.write_audit()', content_table, content_table);
  end loop;
end;
$$;

-- ─── «Удобство локации» (Ф5): список руководителя ────────────────────────────────────────
-- [{kind, name: {ru, uz}, meters?, minutes?, mode?}]: вид — иконка и заголовок («Школа»), название —
-- подпись («Школа №46»), метры — по прямой, минуты — пешком (mode «car» — на машине). До 12 мест.

-- Проверку зовёт ограничение таблицы ролью того, кто пишет: security definer — чтобы она могла
-- звать закрытый private.json_number_between.
create function private.valid_nearby(p_items jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_typeof(p_items) = 'array'
    and jsonb_array_length(p_items) <= 12
    and coalesce((
      select bool_and(case when jsonb_typeof(item) <> 'object' then false else
        item - 'kind' - 'name' - 'meters' - 'minutes' - 'mode' = '{}'::jsonb
        and coalesce(item ->> 'kind' = any (array[
          'school', 'kindergarten', 'mosque', 'clinic', 'shop', 'cafe', 'stop', 'park', 'sport'
        ]), false)
        and case when jsonb_typeof(item -> 'name') <> 'object' then false else
          (item -> 'name') - 'ru' - 'uz' = '{}'::jsonb
          and length(btrim(coalesce(item -> 'name' ->> 'ru', ''))) between 1 and 60
          and length(btrim(coalesce(item -> 'name' ->> 'uz', ''))) between 1 and 60
        end
        and (item -> 'meters' is null or private.json_number_between(item -> 'meters', 1, 50000, true))
        and (item -> 'minutes' is null or private.json_number_between(item -> 'minutes', 1, 240, true))
        and (item -> 'meters' is not null or item -> 'minutes' is not null)
        and coalesce(item ->> 'mode', 'walk') in ('walk', 'car')
      end)
      from jsonb_array_elements(p_items) as item
    ), true)
$$;

revoke all on function private.valid_nearby(jsonb) from public;
grant execute on function private.valid_nearby(jsonb) to authenticated, service_role;

alter table public.complexes
  add constraint complexes_nearby_valid check (private.valid_nearby(nearby));

comment on column public.complexes.nearby is
  'Удобство локации (Ф5): [{kind, name: {ru, uz}, meters?, minutes?, mode?: walk | car}], до 12 мест.';

-- ─── Подсказки «?» к документам и отделке (ТЗ 4.4, 7.8) ──────────────────────────────────
-- Черновики Vodiy House (TODO-заказчик: утвердить; узбекский — проверить носителем). Правятся в
-- «Справочниках»; уже заведённые тексты не трогаем. Начальные данные — без журнала.

alter table public.document_types disable trigger document_types_audit;
update public.document_types t
set hint = jsonb_build_object('ru', h.ru, 'uz', h.uz)
from (values
  ('land', 'Участок под домом оформлен на застройщика: стройку не остановят из-за земли.',
   'Uy ostidagi yer quruvchi nomiga rasmiylashtirilgan: qurilish yer sababli to‘xtamaydi.'),
  ('permit', 'Стройку официально разрешили: дом строят по согласованному проекту.',
   'Qurilishga rasman ruxsat berilgan: uy kelishilgan loyiha bo‘yicha qurilmoqda.'),
  ('declaration', 'Застройщик официально описал проект: что строит, где и в какие сроки.',
   'Quruvchi loyihani rasman tavsiflagan: nima, qayerda va qaysi muddatda qurilishini.'),
  ('expertise', 'Государственные эксперты проверили проект на безопасность и соответствие нормам.',
   'Davlat ekspertlari loyihani xavfsizlik va me’yorlarga muvofiqlik bo‘yicha tekshirgan.'),
  ('seismic', 'Специалисты подтвердили, что дом рассчитан на землетрясения нашего региона.',
   'Mutaxassislar uy mintaqamizdagi zilzilalarga mo‘ljallanganini tasdiqlagan.'),
  ('commissioning', 'Дом достроен и принят комиссией: можно оформлять кадастр и заселяться.',
   'Uy qurib bitkazilgan va komissiya qabul qilgan: kadastrni rasmiylashtirib, ko‘chib kirish mumkin.')
) as h (slug, ru, uz)
where t.slug = h.slug and t.hint is null;
alter table public.document_types enable trigger document_types_audit;

alter table public.finishings disable trigger finishings_audit;
update public.finishings f
set description = jsonb_build_object('ru', h.ru, 'uz', h.uz)
from (values
  ('none', 'Бетонные стены и пол без стяжки и штукатурки: отделку делаете сами.',
   'Beton devor va pol, styajka va suvoqsiz: pardozni o‘zingiz qilasiz.'),
  ('rough', 'Стены оштукатурены, стяжка пола, разведены электрика и трубы; чистовой отделки нет.',
   'Devorlar suvalgan, pol styajkasi, elektr va quvurlar o‘tkazilgan; toza pardoz yo‘q.'),
  ('white-box', 'Ровные стены под покраску, стяжка, электрика и сантехника подведены: остаётся выбрать покрытия.',
   'Bo‘yashga tayyor tekis devorlar, styajka, elektr va santexnika olib kelingan: qoplamalarni tanlash qoladi.'),
  ('turnkey', 'Готовая квартира: покрытия, двери и сантехника на месте — можно сразу заезжать.',
   'Tayyor kvartira: qoplamalar, eshiklar va santexnika joyida — darhol ko‘chib kirish mumkin.')
) as h (slug, ru, uz)
where f.slug = h.slug and f.description is null;
alter table public.finishings enable trigger finishings_audit;

-- ─── Кабинет: документы, видео, детали (вкладки ЖК, решение фазы 3 «Мастер ЖК») ──────────
-- Вкладка сохраняется целиком: чего нет в списке — удаляется, остальное — дописывается или
-- правится (журнал видит только настоящие изменения). Функции security invoker: права — политики
-- выше, роль — первой строкой.

-- [{type_id, checked_on}] — проверенные документы; дата — не позже сегодняшней.
create function public.save_complex_documents(p_complex uuid, p_documents jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Документы ЖК правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_documents) is distinct from 'array' or jsonb_array_length(p_documents) > 30 then
    raise exception 'Нужен список до 30 документов' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  -- case, а не or: приведение к smallint — только после проверки, что это число.
  if exists (
    select 1 from jsonb_array_elements(p_documents) as item
    where case
      when not private.json_number_between(item -> 'type_id', 1, 32767, true) then true
      when nullif(item ->> 'checked_on', '') is null then true
      else not exists (select 1 from public.document_types t where t.id = (item ->> 'type_id')::smallint)
    end
  ) or (
    select count(distinct item ->> 'type_id') <> count(*) from jsonb_array_elements(p_documents) as item
  ) then
    raise exception 'Документ не найден или указан дважды — обновите страницу'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_documents) as item
    where (item ->> 'checked_on')::date > current_date
  ) then
    raise exception 'Дата проверки — не позже сегодняшней'
      using errcode = 'check_violation', hint = 'vh:future_date';
  end if;

  delete from public.complex_documents d
  where d.complex_id = p_complex
    and d.document_type_id not in (
      select (item ->> 'type_id')::smallint from jsonb_array_elements(p_documents) as item
    );
  insert into public.complex_documents (complex_id, document_type_id, checked_on)
  select p_complex, (item ->> 'type_id')::smallint, (item ->> 'checked_on')::date
  from jsonb_array_elements(p_documents) as item
  on conflict (complex_id, document_type_id) do update
    set checked_on = excluded.checked_on
    where public.complex_documents.checked_on is distinct from excluded.checked_on;
end;
$$;

-- [{youtube_id, title: {ru, uz} | null}] — порядок по массиву, первое видео — крупно (ТЗ 7.5).
create function public.save_complex_videos(p_complex uuid, p_videos jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Видео ЖК правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_videos) is distinct from 'array' or jsonb_array_length(p_videos) > 6 then
    raise exception 'Нужен список до 6 видео' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  if (select count(distinct item ->> 'youtube_id') <> count(*) from jsonb_array_elements(p_videos) as item) then
    raise exception 'Видео указано дважды' using errcode = 'check_violation', hint = 'vh:duplicate';
  end if;

  delete from public.complex_videos v
  where v.complex_id = p_complex
    and v.youtube_id not in (select item ->> 'youtube_id' from jsonb_array_elements(p_videos) as item);
  insert into public.complex_videos (complex_id, youtube_id, title, sort)
  select p_complex, item ->> 'youtube_id', nullif(item -> 'title', 'null'::jsonb)::public.i18n_text,
         ord * 10
  from jsonb_array_elements(p_videos) with ordinality as list (item, ord)
  on conflict (complex_id, youtube_id) do update
    set title = excluded.title, sort = excluded.sort
    where (public.complex_videos.title, public.complex_videos.sort)
      is distinct from (excluded.title, excluded.sort);
end;
$$;

-- [{topic_id, text: {ru, uz}, photo_id | null}] — порядок на сайте — по справочнику тем (ТЗ 7.7).
create function public.save_complex_details(p_complex uuid, p_details jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Детали проекта правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details) > 20 then
    raise exception 'Нужен список до 20 тем' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  if exists (
    select 1 from jsonb_array_elements(p_details) as item
    where case
      when not private.json_number_between(item -> 'topic_id', 1, 32767, true) then true
      else not exists (select 1 from public.detail_topics t where t.id = (item ->> 'topic_id')::smallint)
    end
  ) or (
    select count(distinct item ->> 'topic_id') <> count(*) from jsonb_array_elements(p_details) as item
  ) then
    raise exception 'Тема не найдена или указана дважды — обновите страницу'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  -- Фото — только из галереи этого ЖК.
  if exists (
    select 1 from jsonb_array_elements(p_details) as item
    where nullif(item ->> 'photo_id', '') is not null
      and not exists (
        select 1 from public.media_assets m
        where m.id = (item ->> 'photo_id')::uuid and m.complex_id = p_complex and m.kind = 'photo'
      )
  ) then
    raise exception 'Фото не из галереи ЖК — обновите страницу'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;

  delete from public.complex_details d
  where d.complex_id = p_complex
    and d.topic_id not in (
      select (item ->> 'topic_id')::smallint from jsonb_array_elements(p_details) as item
    );
  insert into public.complex_details (complex_id, topic_id, text, photo_id)
  select p_complex, (item ->> 'topic_id')::smallint, (item -> 'text')::public.i18n_text,
         nullif(item ->> 'photo_id', '')::uuid
  from jsonb_array_elements(p_details) as item
  on conflict (complex_id, topic_id) do update
    set text = excluded.text, photo_id = excluded.photo_id
    where (public.complex_details.text, public.complex_details.photo_id)
      is distinct from (excluded.text, excluded.photo_id);
end;
$$;

-- «Убрать из истории» (ошибочная запись): ответ — ЖК, чтобы сбросить кэш его страницы.
create function public.remove_deadline_change(p_change uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  owner uuid;
begin
  if not private.has_role('head') then
    raise exception 'Историю сроков правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  delete from public.deadline_changes d where d.id = p_change returning d.complex_id into owner;
  if owner is null then
    raise exception 'Запись не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return owner;
end;
$$;

-- «Блоки» — как в шаге 11 (20261021090000_complexes_admin.sql) плюс перенос срока: у блока с
-- отметкой deadline_shift новый срок пишется в историю «было → стало».
create or replace function public.save_complex_blocks(p_complex uuid, p_blocks jsonb)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_index integer := 0;
  item_id uuid;
  kept uuid[];
  before text[];
  orphans uuid[];
  removed text[];
  previous public.blocks;
begin
  if not private.has_role('head') then
    raise exception 'Блоки правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_blocks) is distinct from 'array' or jsonb_array_length(p_blocks) > 20 then
    raise exception 'Нужен список до 20 блоков' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  perform private.locked_complex_status(p_complex);
  before := private.complex_missing(p_complex);

  kept := array(
    select nullif(value ->> 'id', '')::uuid from jsonb_array_elements(p_blocks)
    where nullif(value ->> 'id', '') is not null
  );
  if exists (
    select 1 from public.units u join public.blocks b on b.id = u.block_id
    where b.complex_id = p_complex and b.id <> all (kept)
  ) then
    raise exception 'У блока есть список квартир — сначала удалите его на вкладке «Квартиры»'
      using errcode = 'check_violation', hint = 'vh:has_units';
  end if;
  orphans := array(
    select l.drawing_id from public.layouts l join public.blocks b on b.id = l.block_id
    where b.complex_id = p_complex and b.id <> all (kept) and l.drawing_id is not null
  );
  delete from public.blocks b where b.complex_id = p_complex and b.id <> all (kept);

  set constraints public.blocks_complex_id_name_key deferred;
  for item in select value from jsonb_array_elements(p_blocks) loop
    item_index := item_index + 1;
    item_id := nullif(item ->> 'id', '')::uuid;
    if nullif(item ->> 'floors_total', '') is null then
      raise exception 'У блока нужна этажность' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
    end if;
    if item_id is null then
      insert into public.blocks (
        complex_id, name, build_status, progress_pct, floors_total, floors_built, deadline_year,
        deadline_quarter, finishing_id, cadastre, cadastre_expected_on, currency, price_includes, sort
      )
      values (
        p_complex,
        btrim(item ->> 'name'),
        coalesce(item ->> 'build_status', 'building')::public.build_status,
        (item ->> 'progress_pct')::smallint,
        (item ->> 'floors_total')::smallint,
        (item ->> 'floors_built')::smallint,
        (item ->> 'deadline_year')::smallint,
        (item ->> 'deadline_quarter')::smallint,
        (item ->> 'finishing_id')::smallint,
        (item ->> 'cadastre')::public.cadastre_status,
        (item ->> 'cadastre_expected_on')::date,
        coalesce(item ->> 'currency', 'USD')::public.currency,
        coalesce(item -> 'price_includes', '[]'),
        item_index * 10
      );
    else
      -- Этажность — не ниже заведённых квартир: иначе «осталось N» и фасад видят этажи, которых нет.
      if exists (
        select 1 from public.units u
        where u.block_id = item_id and u.floor > (item ->> 'floors_total')::smallint
      ) then
        raise exception 'Выше % этажа есть квартиры — сначала уберите их на вкладке «Квартиры»',
          item ->> 'floors_total'
          using errcode = 'check_violation', hint = 'vh:floors_below_units';
      end if;
      previous := null;
      select * into previous from public.blocks b where b.id = item_id and b.complex_id = p_complex;
      update public.blocks
        set name = btrim(item ->> 'name'),
            build_status = coalesce(item ->> 'build_status', 'building')::public.build_status,
            progress_pct = (item ->> 'progress_pct')::smallint,
            floors_total = (item ->> 'floors_total')::smallint,
            floors_built = (item ->> 'floors_built')::smallint,
            deadline_year = (item ->> 'deadline_year')::smallint,
            deadline_quarter = (item ->> 'deadline_quarter')::smallint,
            finishing_id = (item ->> 'finishing_id')::smallint,
            cadastre = (item ->> 'cadastre')::public.cadastre_status,
            cadastre_expected_on = (item ->> 'cadastre_expected_on')::date,
            currency = coalesce(item ->> 'currency', 'USD')::public.currency,
            price_includes = coalesce(item -> 'price_includes', '[]'),
            sort = item_index * 10
        where id = item_id and complex_id = p_complex;
      if not found then
        raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
      end if;
      -- Перенос (ТЗ 7.3в): прежний и новый срок известны и различаются — запись в историю.
      if coalesce((item ->> 'deadline_shift')::boolean, false)
         and previous.deadline_year is not null
         and nullif(item ->> 'deadline_year', '') is not null
         and (previous.deadline_year, previous.deadline_quarter)
           is distinct from ((item ->> 'deadline_year')::smallint, (item ->> 'deadline_quarter')::smallint)
      then
        insert into public.deadline_changes (
          complex_id, block_id, from_year, from_quarter, to_year, to_quarter
        )
        values (
          p_complex, item_id, previous.deadline_year, previous.deadline_quarter,
          (item ->> 'deadline_year')::smallint, (item ->> 'deadline_quarter')::smallint
        );
      end if;
    end if;
  end loop;
  set constraints public.blocks_complex_id_name_key immediate;

  perform private.assert_complex_not_worse(p_complex, before);

  -- Чертежи удалённых блоков; скопированный в другой блок остаётся.
  with gone as (
    delete from public.media_assets m
    where m.id = any (orphans)
      and not exists (select 1 from public.layouts l where l.drawing_id = m.id)
    returning m.path
  )
  select coalesce(array_agg(path), '{}') into removed from gone;
  return removed;
end;
$$;

comment on function public.save_complex_blocks(uuid, jsonb) is
  'Вкладка «Блоки»: весь список одной транзакцией, порядок — по массиву, перенос срока — в историю. Ответ — пути чертежей удалённых блоков.';

revoke all on function
  public.save_complex_documents(uuid, jsonb),
  public.save_complex_videos(uuid, jsonb),
  public.save_complex_details(uuid, jsonb),
  public.remove_deadline_change(uuid)
from public, anon;
grant execute on function
  public.save_complex_documents(uuid, jsonb),
  public.save_complex_videos(uuid, jsonb),
  public.save_complex_details(uuid, jsonb),
  public.remove_deadline_change(uuid)
to authenticated;

-- ─── Каталог: «Проверено Vodiy House» — из документов ЖК ─────────────────────────────────
-- Тело — как в 20261025120000_site_catalog.sql, кроме checked.permit и checked.land.

create or replace function public.site_catalog()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with shown as (
    select c.*, d.programs_checked_at
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.status = 'published' and d.status = 'published'
  )
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'developers', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', d.id, 'slug', d.slug, 'name', d.name,
          'programs', (
            select coalesce(jsonb_agg(private.site_program(p, d.programs_checked_at)
              order by p.sort, p.created_at), '[]'::jsonb)
            from public.payment_programs p
            where p.developer_id = d.id and p.is_active
              and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)))
        order by d.sort, d.name)
      from public.developers d
      where d.status = 'published' and exists (select 1 from shown s where s.developer_id = d.id)
    ), '[]'::jsonb),
    'complexes', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'slug', s.slug, 'name', s.name, 'class', s.class, 'sort', s.sort,
          'developer_id', s.developer_id,
          'location', (select jsonb_build_object('slug', l.slug, 'kind', l.kind, 'name', l.name)
                       from public.locations l where l.id = s.location_id),
          'address', s.address, 'landmark', s.landmark, 'minutes_to_center', s.minutes_to_center,
          'checked', jsonb_build_object(
            'permit', private.complex_document_on(s.id, 'permit'),
            'land', private.complex_document_on(s.id, 'land'),
            'visit', s.staff_visited_at),
          'created_at', s.created_at,
          'photos', private.catalog_photos(s.id),
          'blocks', private.catalog_blocks(s.id))
        order by s.sort, s.name ->> 'ru')
      from shown s
    ), '[]'::jsonb)
  )
$$;

-- ─── Страница ЖК одним запросом (решение фазы 3 «Данные») ────────────────────────────────

-- Медиафайл для сайта: путь, размеры, заглушка и точка фокуса.
create function private.site_media(m public.media_assets)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when m.id is not null then jsonb_build_object(
    'path', m.path, 'width', m.width, 'height', m.height, 'blur', m.blur,
    'focus_x', m.focus_x, 'focus_y', m.focus_y, 'alt', m.alt)
  end
$$;

-- Блоки ЖК: всё для карточки блока, наличия и «Платёж от» (наличие по комнатам — как у каталога).
-- free — свободных квартир блока, включая без планировки (null — у блока нет списка квартир).
create function private.complex_page_blocks(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'currency', b.currency, 'build_status', b.build_status,
      'progress_pct', b.progress_pct, 'floors_total', b.floors_total, 'floors_built', b.floors_built,
      'deadline_year', b.deadline_year, 'deadline_quarter', b.deadline_quarter,
      'finishing', (select jsonb_build_object('slug', f.slug, 'name', f.name, 'description', f.description)
                    from public.finishings f where f.id = b.finishing_id),
      'cadastre', b.cadastre, 'cadastre_expected_on', b.cadastre_expected_on,
      'price_includes', b.price_includes,
      'free', (select case when count(*) > 0 then (count(*) filter (where u.status = 'free'))::integer end
               from public.units u where u.block_id = b.id),
      'offers', private.catalog_offers(b.id),
      'deadline_history', (
        select coalesce(jsonb_agg(jsonb_build_object(
            'from_year', h.from_year, 'from_quarter', h.from_quarter,
            'to_year', h.to_year, 'to_quarter', h.to_quarter, 'changed_on', h.changed_on)
          order by h.changed_on, h.created_at), '[]'::jsonb)
        from public.deadline_changes h where h.block_id = b.id))
    order by b.sort, b.name), '[]'::jsonb)
  from public.blocks b
  where b.complex_id = p_complex
$$;

-- Планировки: «осталось N» и «цена от» — как private.layout_offers; этажи — по квартирам
-- планировки («этажи 2–12»), чертёж — только у планировки с чертежом.
create function private.complex_page_layouts(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.layout_id, 'block_id', o.block_id, 'rooms', o.rooms, 'area', o.area,
      'free', o.free_count, 'available', o.available, 'price_from', o.price_from,
      'floor_from', floors.low, 'floor_to', floors.high,
      'drawing', private.site_media(m))
    order by o.block_sort, o.block_name, o.rooms, o.area, o.sort), '[]'::jsonb)
  from private.layout_offers o
  join public.layouts l on l.id = o.layout_id
  left join public.media_assets m on m.id = l.drawing_id
  cross join lateral (
    select min(u.floor) as low, max(u.floor) as high from public.units u where u.layout_id = o.layout_id
  ) floors
  where o.complex_id = p_complex
$$;

-- Другие ЖК застройщика на сайте (ТЗ 7.9): обложка, город, цена «от» по блокам (валюта блока).
create function private.complex_page_others(p_complex uuid, p_developer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'slug', c.slug, 'name', c.name,
      'location', (select l.name from public.locations l where l.id = c.location_id),
      'photo', (select private.site_media(m) from public.media_assets m
                where m.complex_id = c.id and m.kind = 'photo'
                order by m.sort, m.created_at limit 1),
      'prices', (select coalesce(jsonb_agg(jsonb_build_object('currency', o.currency, 'price_from', o.price_from)), '[]'::jsonb)
                 from (select x.currency, min(x.price_from) as price_from
                       from private.layout_offers x
                       where x.complex_id = c.id and x.available and x.price_from is not null
                       group by x.block_id, x.currency) o))
    order by c.sort, c.name ->> 'ru'), '[]'::jsonb)
  from public.complexes c
  where c.developer_id = p_developer and c.id <> p_complex and private.is_public_complex(c.id)
$$;

-- Застройщик ЖК: «с N года», «Сдано N ЖК · Строится M ЖК» — только по ЖК на сайте (ТЗ 7.9),
-- «Есть сданные объекты» (дата проверки), логотип, программы без скидок (PLAN §3.13).
create function private.complex_page_developer(p_developer uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', d.id, 'slug', d.slug, 'name', d.name, 'about', d.about, 'founded_year', d.founded_year,
    'delivered_checked_at', d.delivered_checked_at,
    'logo', (select private.site_media(m) from public.media_assets m
             where m.developer_id = d.id and m.kind = 'logo'),
    'complexes_built', (
      select count(*) from public.complexes c
      where c.developer_id = d.id and private.is_public_complex(c.id)
        and exists (select 1 from public.blocks b where b.complex_id = c.id)
        and not exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status <> 'delivered')),
    'complexes_building', (
      select count(*) from public.complexes c
      where c.developer_id = d.id and private.is_public_complex(c.id)
        and exists (select 1 from public.blocks b where b.complex_id = c.id and b.build_status <> 'delivered')),
    'programs', (
      select coalesce(jsonb_agg(private.site_program(p, d.programs_checked_at)
        order by p.sort, p.created_at), '[]'::jsonb)
      from public.payment_programs p
      where p.developer_id = d.id and p.is_active
        and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)))
  from public.developers d
  where d.id = p_developer
$$;

-- Документы, видео и детали — по порядку сайта.
create function private.complex_page_content(p_complex uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'documents', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'slug', t.slug, 'name', t.name, 'hint', t.hint, 'checked_on', d.checked_on)
        order by t.sort, t.id), '[]'::jsonb)
      from public.complex_documents d
      join public.document_types t on t.id = d.document_type_id
      where d.complex_id = p_complex),
    'videos', (
      select coalesce(jsonb_agg(jsonb_build_object('youtube_id', v.youtube_id, 'title', v.title)
        order by v.sort, v.id), '[]'::jsonb)
      from public.complex_videos v
      where v.complex_id = p_complex),
    'details', (
      select coalesce(jsonb_agg(jsonb_build_object(
          'slug', t.slug, 'name', t.name, 'text', d.text, 'photo', private.site_media(m))
        order by t.sort, t.id), '[]'::jsonb)
      from public.complex_details d
      join public.detail_topics t on t.id = d.topic_id
      left join public.media_assets m on m.id = d.photo_id
      where d.complex_id = p_complex)
  )
$$;

-- Страница ЖК по адресу: посетителю — опубликованный ЖК опубликованного застройщика, сотрудникам —
-- любой (предпросмотр, шаг 3.6); иначе null. Без полей сотрудников и скидок; «обновлено» у
-- наличия — последняя правка квартир, планировок или блоков ЖК (вместо «live», PLAN §3.22).
create function public.site_complex(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'complex', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'name', c.name, 'status', c.status,
      'short_description', c.short_description, 'class', c.class, 'house_type', c.house_type,
      'ceiling_height', c.ceiling_height, 'parking', c.parking,
      'location', (select jsonb_build_object('slug', l.slug, 'kind', l.kind, 'name', l.name)
                   from public.locations l where l.id = c.location_id),
      'address', c.address, 'landmark', c.landmark, 'minutes_to_center', c.minutes_to_center,
      'lat', c.lat, 'lng', c.lng, 'nearby', c.nearby,
      'checked', jsonb_build_object(
        'permit', private.complex_document_on(c.id, 'permit'),
        'land', private.complex_document_on(c.id, 'land'),
        'visit', c.staff_visited_at),
      'stock_updated_at', (
        select greatest(
          (select max(u.updated_at) from public.units u join public.blocks b on b.id = u.block_id
            where b.complex_id = c.id),
          (select max(l.updated_at) from public.layouts l join public.blocks b on b.id = l.block_id
            where b.complex_id = c.id),
          (select max(b.updated_at) from public.blocks b where b.complex_id = c.id)))),
    'developer', private.complex_page_developer(c.developer_id),
    'photos', (
      select coalesce(jsonb_agg(private.site_media(m) order by m.sort, m.created_at, m.id), '[]'::jsonb)
      from public.media_assets m where m.complex_id = c.id and m.kind = 'photo'),
    'blocks', private.complex_page_blocks(c.id),
    'layouts', private.complex_page_layouts(c.id),
    'others', private.complex_page_others(c.id, c.developer_id)
  ) || private.complex_page_content(c.id)
  from public.complexes c
  where c.slug = p_slug and (private.is_public_complex(c.id) or private.is_staff())
$$;

comment on function public.site_complex(text) is
  'Страница ЖК (шаг 3.5): ЖК, застройщик с программами без скидок, фото, блоки с наличием и историей сроков, планировки, документы, видео, детали, другие ЖК застройщика.';

revoke all on function
  private.site_media(public.media_assets),
  private.complex_page_blocks(uuid),
  private.complex_page_layouts(uuid),
  private.complex_page_others(uuid, uuid),
  private.complex_page_developer(uuid),
  private.complex_page_content(uuid),
  public.site_complex(text)
from public;
grant execute on function public.site_complex(text) to anon, authenticated, service_role;
