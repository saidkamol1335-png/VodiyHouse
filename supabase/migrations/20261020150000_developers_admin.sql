-- Фаза 1 · шаг 10.2: кабинет застройщиков и справочников (решения Д1–Д6).
-- Журнал застройщика, создание с адресом на сайте, публикация только готового, сданные объекты
-- одной транзакцией, строки списков для кабинета, справочники: порядок и «удалить или скрыть».
-- Права — те же политики RLS: функции security invoker, правит только руководитель.

-- ─── Журнал: к какому застройщику относится строка ───────────────────────────────────────
-- Для вкладки «Журнал» у застройщика. Как и complex_id — без внешнего ключа: записи переживают
-- окончательное удаление застройщика после архива.
alter table public.audit_log add column developer_id uuid;

create index audit_log_developer_idx on public.audit_log (developer_id, at desc)
  where developer_id is not null;

-- ЖК застройщика сюда не попадают: у них свой журнал (вкладка ЖК), иначе журнал застройщика
-- утонул бы в квартирах.
create function private.audit_developer_id(entity text, row_data jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when entity = 'developers' then nullif(row_data ->> 'id', '')::uuid
    when entity in ('developer_past_projects', 'developer_private', 'media_assets')
      then nullif(row_data ->> 'developer_id', '')::uuid
  end
$$;

-- Та же функция, что в миграции журнала, плюс developer_id.
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
begin
  if current_setting('vodiy.skip_audit', true) = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(field.key, jsonb_build_array(old_row -> field.key, field.value)), '{}')
      into changes
      from jsonb_each(new_row) as field
      where field.value is distinct from old_row -> field.key
        and field.key not in ('updated_at', 'updated_by');
    if changes = '{}'::jsonb then
      return null;
    end if;
  else
    changes := row_data - 'created_at' - 'updated_at';
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

revoke all on function private.audit_developer_id(text, jsonb) from public;

-- Журнал для кабинета: застройщик или всё подряд («Настройки → Журнал»), страницами от новых
-- к старым. Права — RLS журнала (руководитель и менеджер); имя автора — из profiles.
-- subject — о ком запись: застройщик, ЖК, сотрудник по текущему названию, иначе — название из
-- самой записи (добавленное или удалённое значение справочника).
create function public.journal_entries(
  p_developer uuid default null,
  p_before bigint default null,
  p_limit integer default 50
)
returns table (
  id bigint,
  at timestamptz,
  action public.audit_action,
  entity text,
  entity_id text,
  changes jsonb,
  actor_name text,
  subject text
)
language sql
stable
set search_path = ''
as $$
  select a.id, a.at, a.action, a.entity, a.entity_id, a.changes, p.full_name,
         coalesce(
           -- Сданный объект — своим названием, а не названием застройщика.
           case when a.entity = 'developer_past_projects' then coalesce(
             (select pp.name ->> 'ru' from public.developer_past_projects pp where pp.id::text = a.entity_id),
             a.changes -> 'name' ->> 'ru')
           end,
           (select d.name from public.developers d where d.id = a.developer_id),
           (select c.name ->> 'ru' from public.complexes c where c.id = a.complex_id),
           (select s.full_name from public.profiles s where a.entity = 'profiles' and s.id::text = a.entity_id),
           a.changes ->> 'full_name',
           case jsonb_typeof(a.changes -> 'name')
             when 'string' then a.changes ->> 'name'
             when 'object' then a.changes -> 'name' ->> 'ru'
           end,
           a.changes -> 'term' ->> 'ru',
           a.changes ->> 'key'
         )
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  where (p_developer is null or a.developer_id = p_developer)
    and (p_before is null or a.id < p_before)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

comment on function public.journal_entries(uuid, bigint, integer) is
  'Журнал изменений для кабинета: по застройщику или весь, страницами (p_before — id последней строки).';

revoke all on function public.journal_entries(uuid, bigint, integer) from public, anon;
grant execute on function public.journal_entries(uuid, bigint, integer) to authenticated;

-- ─── Застройщик: создание ────────────────────────────────────────────────────────────────
-- Адрес на сайте даёт кабинет (lib/slug.ts); занят — добавляем -2, -3…; «demo-» — только у DEMO:
-- `npm run demo:remove` удаляет всё с этим префиксом.
create function public.create_developer(p_name text, p_slug text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  candidate text := p_slug;
  suffix integer := 1;
  new_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'Застройщика добавляет руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_slug ~ '^demo(-|$)' then
    raise exception 'Адрес «demo-…» занят DEMO-данными' using errcode = 'check_violation', hint = 'vh:slug_reserved';
  end if;
  loop
    begin
      insert into public.developers (name, slug, sort)
      values (
        p_name,
        candidate,
        (select coalesce(max(d.sort), 0) + 10 from public.developers d)
      )
      returning id into new_id;
      return new_id;
    exception when unique_violation then
      suffix := suffix + 1;
      if suffix > 99 then
        raise;
      end if;
      candidate := p_slug || '-' || suffix;
    end;
  end loop;
end;
$$;

comment on function public.create_developer(text, text) is
  'Новый застройщик-черновик в конце списка; занятый адрес на сайте получает суффикс -2, -3…';

revoke all on function public.create_developer(text, text) from public, anon;
grant execute on function public.create_developer(text, text) to authenticated;

-- ─── Застройщик: публикация только готового ──────────────────────────────────────────────
-- Страница застройщика на сайте (ТЗ 8.2, 8.4) без логотипа и текста «О компании» пустая.
-- Проверка — при переходе в «Опубликован» на любом пути (кабинет, SQL); DEMO-сид вставляет
-- опубликованных сразу и её не задевает.
create function private.check_developer_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.about is null then
    raise exception 'Для публикации нужен текст «О компании» на двух языках'
      using errcode = 'check_violation', hint = 'vh:not_ready';
  end if;
  if not exists (
    select 1 from public.media_assets m where m.developer_id = new.id and m.kind = 'logo'
  ) then
    raise exception 'Для публикации нужен логотип' using errcode = 'check_violation', hint = 'vh:not_ready';
  end if;
  return new;
end;
$$;

revoke all on function private.check_developer_publishable() from public;

create trigger developers_check_publishable
  before update of status on public.developers
  for each row
  when (new.status = 'published' and old.status is distinct from 'published')
  execute function private.check_developer_publishable();

-- ─── Логотип и фон застройщика (шаг 9.4, решение Д4) ─────────────────────────────────────
-- Файл браузер уже положил в бакет (политика Storage: руководитель, папка застройщика).
-- Замена — одной транзакцией: старая строка уходит, новая встаёт; путь старого файла
-- возвращается — сервер удалит его из бакета через Storage API (прямой delete там запрещён).
create function public.set_developer_media(
  p_developer uuid,
  p_kind public.media_kind,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_focus_x real default 0.5,
  p_focus_y real default 0.5
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Фото застройщика загружает руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_kind not in ('logo', 'cover') then
    raise exception 'У застройщика только логотип и фон' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  delete from public.media_assets
  where developer_id = p_developer and kind = p_kind
  returning path into old_path;
  insert into public.media_assets (developer_id, kind, path, width, height, blur, focus_x, focus_y)
  values (p_developer, p_kind, p_path, p_width, p_height, p_blur, p_focus_x, p_focus_y);
  return old_path;
end;
$$;

-- Опубликованный застройщик без логотипа — пустая карточка на сайте: логотип у него только
-- заменяют. Ответ — путь удалённого файла (null — удалять нечего).
create function public.remove_developer_media(p_developer uuid, p_kind public.media_kind)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Фото застройщика удаляет руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_kind = 'logo' and exists (
    select 1 from public.developers d where d.id = p_developer and d.status = 'published'
  ) then
    raise exception 'У опубликованного застройщика логотип можно только заменить'
      using errcode = 'check_violation', hint = 'vh:not_ready';
  end if;
  delete from public.media_assets
  where developer_id = p_developer and kind = p_kind
  returning path into old_path;
  return old_path;
end;
$$;

comment on function public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real) is
  'Логотип или фон застройщика: заменяет прежний одной транзакцией, возвращает путь старого файла.';
comment on function public.remove_developer_media(uuid, public.media_kind) is
  'Удаляет логотип или фон (логотип опубликованного — нельзя), возвращает путь файла.';

revoke all on function
  public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real),
  public.remove_developer_media(uuid, public.media_kind)
from public, anon;
grant execute on function
  public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real),
  public.remove_developer_media(uuid, public.media_kind)
to authenticated;

-- ─── Сданные объекты: вкладка сохраняется целиком (решение Д2) ───────────────────────────
-- Одна транзакция: правка, новые, удалённые и порядок. Журнал пишет только изменённое.
-- Формат: [{id?, name: {ru, uz}, planned_on, delivered_on}] в нужном порядке.
create function public.save_developer_past_projects(p_developer uuid, p_projects jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_index integer := 0;
  kept uuid[] := '{}';
  item_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'Сданные объекты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_projects) is distinct from 'array' or jsonb_array_length(p_projects) > 50 then
    raise exception 'Нужен список до 50 объектов' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if not exists (select 1 from public.developers d where d.id = p_developer) then
    raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;

  for item in select value from jsonb_array_elements(p_projects) loop
    item_index := item_index + 1;
    item_id := nullif(item ->> 'id', '')::uuid;
    if item_id is null then
      insert into public.developer_past_projects (developer_id, name, planned_on, delivered_on, sort)
      values (
        p_developer,
        (item -> 'name')::public.i18n_text,
        (item ->> 'planned_on')::date,
        (item ->> 'delivered_on')::date,
        item_index * 10
      )
      returning id into item_id;
    else
      update public.developer_past_projects
        set name = (item -> 'name')::public.i18n_text,
            planned_on = (item ->> 'planned_on')::date,
            delivered_on = (item ->> 'delivered_on')::date,
            sort = item_index * 10
        where id = item_id and developer_id = p_developer;
      if not found then
        raise exception 'Объект не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
      end if;
    end if;
    kept := kept || item_id;
  end loop;

  delete from public.developer_past_projects
  where developer_id = p_developer and id <> all (kept);
end;
$$;

comment on function public.save_developer_past_projects(uuid, jsonb) is
  'Вкладка «Сданные объекты»: весь список одной транзакцией, порядок — по массиву.';

revoke all on function public.save_developer_past_projects(uuid, jsonb) from public, anon;
grant execute on function public.save_developer_past_projects(uuid, jsonb) to authenticated;

-- ─── Список застройщиков (решение Д1) ────────────────────────────────────────────────────
-- «N ЖК» — без архивных; логотип — путь в бакете media. Только руководителю: раздел его.
create function public.developer_rows()
returns table (
  id uuid,
  slug text,
  name text,
  status public.publication_status,
  founded_year smallint,
  flats_delivered integer,
  delivered_checked_at date,
  archived_at timestamptz,
  complexes integer,
  logo_path text,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select d.id, d.slug, d.name, d.status, d.founded_year, d.flats_delivered, d.delivered_checked_at,
         d.archived_at,
         (select count(*)::integer from public.complexes c
           where c.developer_id = d.id and c.status <> 'archived'),
         m.path,
         d.updated_at
  from public.developers d
  left join public.media_assets m on m.developer_id = d.id and m.kind = 'logo'
  where (select private.has_role('head'))
  order by d.sort, d.name
$$;

comment on function public.developer_rows() is
  'Строки списка «Застройщики» в кабинете: только руководителю; остальным — пусто.';

revoke all on function public.developer_rows() from public, anon;
grant execute on function public.developer_rows() to authenticated;

-- ─── Справочники (решение Д6) ────────────────────────────────────────────────────────────
-- Подсказки к терминам сюда не входят: их набор задаёт расчёт (фаза 2), правится только текст.
create function private.dictionary_table(p_dictionary text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_dictionary in ('locations', 'document_types', 'detail_topics', 'finishings') then
    return p_dictionary;
  end if;
  raise exception 'Нет такого справочника' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
end;
$$;

revoke all on function private.dictionary_table(text) from public;
grant execute on function private.dictionary_table(text) to authenticated;

-- Порядок перетаскиванием: весь список id в новом порядке.
create function public.reorder_dictionary(p_dictionary text, p_ids smallint[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Справочники правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  execute format(
    'update public.%I as t set sort = x.ord * 10
       from unnest($1::smallint[]) with ordinality as x(id, ord)
      where t.id = x.id and t.sort is distinct from (x.ord * 10)::smallint',
    private.dictionary_table(p_dictionary)
  ) using p_ids;
end;
$$;

-- Значение, которое уже где-то стоит (город у ЖК, отделка у блока), не удаляется, а скрывается:
-- иначе ЖК потерял бы город. Ответ — что сделано: 'deleted' или 'hidden'.
create function public.remove_dictionary_item(p_dictionary text, p_id smallint)
returns text
language plpgsql
set search_path = ''
as $$
declare
  dictionary text := private.dictionary_table(p_dictionary);
  removed integer;
begin
  if not private.has_role('head') then
    raise exception 'Справочники правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  begin
    execute format('delete from public.%I where id = $1', dictionary) using p_id;
    get diagnostics removed = row_count;
  exception when foreign_key_violation or restrict_violation then
    execute format('update public.%I set is_active = false where id = $1', dictionary) using p_id;
    return 'hidden';
  end;
  if removed = 0 then
    raise exception 'Значение не найдено — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return 'deleted';
end;
$$;

comment on function public.reorder_dictionary(text, smallint[]) is
  'Порядок значений справочника: id в новом порядке.';
comment on function public.remove_dictionary_item(text, smallint) is
  'Удаляет значение справочника, а используемое — скрывает. Возвращает deleted или hidden.';

revoke all on function public.reorder_dictionary(text, smallint[]), public.remove_dictionary_item(text, smallint)
  from public, anon;
grant execute on function public.reorder_dictionary(text, smallint[]), public.remove_dictionary_item(text, smallint)
  to authenticated;
