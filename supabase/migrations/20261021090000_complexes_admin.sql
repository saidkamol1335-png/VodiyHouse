-- Фаза 1 · шаг 11: кабинет ЖК (решения И1–И9, 21.10.2026).
-- Создание ЖК, строки списка, готовность к публикации и её проверка, отметка правила 1.2,
-- галерея и чертежи, блоки и планировки вкладкой — одной транзакцией, журнал ЖК.
-- Права — те же политики RLS: функции security invoker, правит только руководитель. Готовность
-- читает закрытый вид private.layout_offers, поэтому она security definer и только читает.

-- ─── Поля ЖК и блока ─────────────────────────────────────────────────────────────────────
-- Этажность считается по блокам (И3): одна правда вместо двух.
alter table public.complexes drop column floors_min, drop column floors_max;

-- Отметка правила 1.2 (И8): «Опубликовать» ставит её в том же действии — база проверяет, что
-- её поставили заново, а не оставили с прошлой публикации.
alter table public.complexes add column files_checked_at timestamptz;

-- Лимиты — под одну строку в карточке каталога (390) и в шапке ЖК (1440), «реши сам».
alter table public.complexes
  add constraint complexes_point_check check ((lat is null) = (lng is null)),
  add constraint complexes_address_length
    check (length(address ->> 'ru') <= 60 and length(address ->> 'uz') <= 60),
  add constraint complexes_landmark_length
    check (length(landmark ->> 'ru') <= 50 and length(landmark ->> 'uz') <= 50);

-- Название блока — код (A, B, 1): слово «Блок» / «blok» сайт добавляет сам на обоих языках.
alter table public.blocks
  drop constraint blocks_name_check,
  add constraint blocks_name_check check (length(btrim(name)) between 1 and 8);

-- ─── Готовность к публикации (PLAN 3а, И7, И9) ───────────────────────────────────────────
-- Порядок пунктов — порядок вкладок. have — сколько фото есть (для «нужно ещё N»).
-- p_row — строка ЖК до записи (триггер проверяет NEW), иначе читается из таблицы.
-- Цифры совпадают с lib/admin/complexes/readiness.ts (тест сверяет).
create function private.complex_requirements(p_complex uuid, p_row public.complexes default null)
returns table (requirement text, ok boolean, have integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.complexes;
  photo_count integer;
  cover_side integer;
begin
  if p_row is null then
    select * into r from public.complexes c where c.id = p_complex;
  else
    r := p_row;
  end if;
  select count(*)::integer into photo_count
    from public.media_assets m where m.complex_id = p_complex and m.kind = 'photo';
  -- Обложка — первое фото галереи (ТЗ 12).
  select greatest(m.width, m.height) into cover_side
    from public.media_assets m
    where m.complex_id = p_complex and m.kind = 'photo'
    order by m.sort, m.created_at, m.id
    limit 1;

  return query
  select x.requirement, x.ok, x.have
  from (values
    (1, 'address', r.address is not null, null::integer),
    (2, 'location', r.location_id is not null, null::integer),
    (3, 'point', r.lat is not null and r.lng is not null, null::integer),
    (4, 'developer', exists (
      select 1 from public.developers d where d.id = r.developer_id and d.status <> 'archived'
    ), null::integer),
    (5, 'blocks', exists (
      select 1 from public.blocks b where b.complex_id = p_complex and b.deadline_year is not null
    ), null::integer),
    -- Планировка с чертежом и ценой: ручной «цена от» или цена свободной квартиры этой планировки.
    (6, 'layouts', exists (
      select 1
      from private.layout_offers o
      join public.layouts l on l.id = o.layout_id
      where o.complex_id = p_complex and l.drawing_id is not null and o.price_from is not null
    ), null::integer),
    (7, 'photos', photo_count >= 5, photo_count),
    (8, 'cover', coalesce(cover_side >= 2400, false), null::integer)
  ) as x (ord, requirement, ok, have)
  order by x.ord;
end;
$$;

create function private.complex_missing(p_complex uuid, p_row public.complexes default null)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(q.requirement), '{}')
  from private.complex_requirements(p_complex, p_row) q
  where not q.ok
$$;

-- Опубликованный ЖК не теряет готовность: правка, после которой не выполнено условие, что
-- выполнялось до неё, отклоняется («не делает хуже», 21.10.2026). DEMO без фото остаётся правимым.
create function private.assert_complex_not_worse(p_complex uuid, p_before text[])
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  worse text[];
begin
  if not exists (select 1 from public.complexes c where c.id = p_complex and c.status = 'published') then
    return;
  end if;
  worse := array(
    select unnest(private.complex_missing(p_complex)) except select unnest(p_before)
  );
  if cardinality(worse) > 0 then
    raise exception 'Опубликованный ЖК перестал бы отвечать условиям публикации'
      using errcode = 'check_violation', hint = 'vh:not_ready', detail = array_to_string(worse, ',');
  end if;
end;
$$;

-- Кабинет: строка «Для публикации: N из M» (И9) — сотрудникам; сайту — пусто.
create function public.complex_readiness(p_complex uuid)
returns table (requirement text, ok boolean, have integer)
language sql
stable
security definer
set search_path = ''
as $$
  select q.requirement, q.ok, q.have
  from private.complex_requirements(p_complex) q
  where private.is_staff() and exists (select 1 from public.complexes c where c.id = p_complex)
$$;

comment on function public.complex_readiness(uuid) is
  'Чего не хватает ЖК для публикации (PLAN 3а): пункт, выполнен ли, сколько фото есть.';

revoke all on function
  private.complex_requirements(uuid, public.complexes),
  private.complex_missing(uuid, public.complexes),
  private.assert_complex_not_worse(uuid, text[]),
  public.complex_readiness(uuid)
from public, anon;
grant execute on function
  private.complex_missing(uuid, public.complexes),
  private.assert_complex_not_worse(uuid, text[]),
  public.complex_readiness(uuid)
to authenticated;

-- ─── Проверка при правке ЖК ──────────────────────────────────────────────────────────────
-- На любом пути (кабинет, SQL): публикация — только готового и с отметкой 1.2, сделанной в
-- этом же действии; опубликованный не теряет готовность; у застройщика в архиве ЖК остаётся в
-- архиве. DEMO-сид вставляет опубликованные ЖК сразу — вставку триггер не проверяет.
create function private.check_complex_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing text[];
begin
  if new.status <> 'archived' and exists (
    select 1 from public.developers d where d.id = new.developer_id and d.status = 'archived'
  ) then
    raise exception 'Застройщик в архиве — сначала восстановите его'
      using errcode = 'check_violation', hint = 'vh:developer_archived';
  end if;
  if new.status <> 'published' then
    return new;
  end if;

  if old.status is distinct from 'published' then
    missing := private.complex_missing(new.id, new);
  else
    missing := array(
      select unnest(private.complex_missing(new.id, new))
      except select unnest(private.complex_missing(old.id, old))
    );
  end if;
  if cardinality(missing) > 0 then
    raise exception 'ЖК не отвечает условиям публикации'
      using errcode = 'check_violation', hint = 'vh:not_ready', detail = array_to_string(missing, ',');
  end if;

  if old.status is distinct from 'published'
     and (new.files_checked_at is null or new.files_checked_at is not distinct from old.files_checked_at) then
    raise exception 'Перед публикацией отметьте проверку файлов по правилу 1.2'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  return new;
end;
$$;

revoke all on function private.check_complex_update() from public;

create trigger complexes_check_update
  before update on public.complexes
  for each row execute function private.check_complex_update();

-- ─── Создание ЖК (решение «реши сам» шага 11) ────────────────────────────────────────────
-- Адрес на сайте даёт кабинет (lib/slug.ts, из UZ-названия); занят — -2, -3…; «demo-» — только
-- у DEMO. Новый ЖК — черновик в конце каталога.
create function public.create_complex(p_developer uuid, p_name jsonb, p_slug text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  candidate text := p_slug;
  suffix integer := 1;
  developer_status public.publication_status;
  new_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'ЖК добавляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select d.status into developer_status from public.developers d where d.id = p_developer;
  if developer_status is null then
    raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if developer_status = 'archived' then
    raise exception 'Застройщик в архиве' using errcode = 'check_violation', hint = 'vh:developer_archived';
  end if;
  if p_slug ~ '^demo(-|$)' then
    raise exception 'Адрес «demo-…» занят DEMO-данными' using errcode = 'check_violation', hint = 'vh:slug_reserved';
  end if;
  loop
    begin
      insert into public.complexes (developer_id, name, slug, sort)
      values (
        p_developer,
        p_name::public.i18n_text,
        candidate,
        (select coalesce(max(c.sort), 0) + 10 from public.complexes c)
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

comment on function public.create_complex(uuid, jsonb, text) is
  'Новый ЖК-черновик в конце каталога; занятый адрес на сайте получает суффикс -2, -3…';

revoke all on function public.create_complex(uuid, jsonb, text) from public, anon;
grant execute on function public.create_complex(uuid, jsonb, text) to authenticated;

-- ─── Список ЖК (решение в. 5) ────────────────────────────────────────────────────────────
-- Остатки по комнатам — из room_availability(); здесь — строка и застройщик. Руководителю и
-- менеджеру (шаг 12: вкладка «Квартиры»); остальным — пусто.
create function public.complex_rows()
returns table (
  id uuid,
  slug text,
  name jsonb,
  status public.publication_status,
  archived_at timestamptz,
  developer_id uuid,
  developer_name text,
  developer_status public.publication_status,
  location_name text,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.slug, c.name, c.status, c.archived_at, d.id, d.name, d.status, l.name ->> 'ru',
         c.updated_at
  from public.complexes c
  join public.developers d on d.id = c.developer_id
  left join public.locations l on l.id = c.location_id
  where (select private.has_role('head', 'manager'))
  order by c.sort, c.name ->> 'ru'
$$;

comment on function public.complex_rows() is
  'Строки списка «ЖК» в кабинете — в порядке каталога; руководителю и менеджеру.';

revoke all on function public.complex_rows() from public, anon;
grant execute on function public.complex_rows() to authenticated;

-- ─── Фото и чертежи (И6, И8) ─────────────────────────────────────────────────────────────
-- Файл браузер уже положил в бакет (политика Storage: руководитель, папка ЖК). В опубликованный
-- ЖК файл попадает сразу на сайт, поэтому загрузка требует отметки правила 1.2.

create function private.locked_complex_status(p_complex uuid)
returns public.publication_status
language plpgsql
set search_path = ''
as $$
declare
  current_status public.publication_status;
begin
  select c.status into current_status from public.complexes c where c.id = p_complex for update;
  if current_status is null then
    raise exception 'ЖК не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return current_status;
end;
$$;

create function private.require_rule12(p_status public.publication_status, p_confirmed boolean)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_status = 'published' and not coalesce(p_confirmed, false) then
    raise exception 'Отметьте, что на файлах нет контактов застройщика (правило 1.2)'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
end;
$$;

-- Галерея — до 30 фото (PLAN 3а: нагрузка «15 ЖК по 30 фото»), новое — в конец.
create function public.add_complex_photo(
  p_complex uuid,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_rule12 boolean default false
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'Фото ЖК загружает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.require_rule12(private.locked_complex_status(p_complex), p_rule12);
  if (select count(*) from public.media_assets m where m.complex_id = p_complex and m.kind = 'photo') >= 30 then
    raise exception 'В галерее уже 30 фото' using errcode = 'check_violation', hint = 'vh:too_many';
  end if;
  insert into public.media_assets (complex_id, kind, path, width, height, blur, sort)
  values (
    p_complex, 'photo', p_path, p_width, p_height, p_blur,
    (select coalesce(max(m.sort), 0) + 10 from public.media_assets m
      where m.complex_id = p_complex and m.kind = 'photo')
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Порядок галереи: все фото ЖК в новом порядке, первое — обложка.
create function public.reorder_complex_photos(p_complex uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  before text[];
begin
  if not private.has_role('head') then
    raise exception 'Фото ЖК правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.locked_complex_status(p_complex);
  if cardinality(p_ids) is distinct from (
       select count(*) from public.media_assets m where m.complex_id = p_complex and m.kind = 'photo')
     or exists (
       select 1 from unnest(p_ids) as x (id)
       where not exists (
         select 1 from public.media_assets m
         where m.id = x.id and m.complex_id = p_complex and m.kind = 'photo')
     )
     or cardinality(p_ids) <> (select count(distinct x) from unnest(p_ids) as x) then
    raise exception 'Список фото устарел — обновите страницу' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  before := private.complex_missing(p_complex);
  update public.media_assets m set sort = x.ord * 10
    from unnest(p_ids) with ordinality as x (id, ord)
    where m.id = x.id and m.sort is distinct from (x.ord * 10)::integer;
  perform private.assert_complex_not_worse(p_complex, before);
end;
$$;

-- Ответ — путь файла: сервер удалит его из бакета через Storage API.
create function public.remove_complex_photo(p_complex uuid, p_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  before text[];
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Фото ЖК удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.locked_complex_status(p_complex);
  before := private.complex_missing(p_complex);
  delete from public.media_assets m
    where m.id = p_id and m.complex_id = p_complex and m.kind = 'photo'
    returning m.path into old_path;
  if old_path is null then
    raise exception 'Фото не найдено — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.assert_complex_not_worse(p_complex, before);
  return old_path;
end;
$$;

-- Чертёж планировки: строка media_assets сразу, привязка — при «Сохранить вкладку»
-- (save_block_layouts); непривязанные чертежи старше суток убирает то же сохранение.
create function public.add_complex_drawing(
  p_complex uuid,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_rule12 boolean default false
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'Чертежи загружает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.require_rule12(private.locked_complex_status(p_complex), p_rule12);
  insert into public.media_assets (complex_id, kind, path, width, height, blur)
  values (p_complex, 'drawing', p_path, p_width, p_height, p_blur)
  returning id into new_id;
  return new_id;
end;
$$;

comment on function public.add_complex_photo(uuid, text, integer, integer, text, boolean) is
  'Фото в конец галереи ЖК (до 30); у опубликованного ЖК — только с отметкой правила 1.2.';
comment on function public.reorder_complex_photos(uuid, uuid[]) is
  'Порядок галереи ЖК: все фото в новом порядке, первое — обложка.';
comment on function public.remove_complex_photo(uuid, uuid) is
  'Удаляет фото ЖК (опубликованный не опускается ниже условий публикации), возвращает путь файла.';
comment on function public.add_complex_drawing(uuid, text, integer, integer, text, boolean) is
  'Чертёж планировки ЖК: строка media_assets, привязка — при сохранении планировок.';

revoke all on function
  private.locked_complex_status(uuid),
  private.require_rule12(public.publication_status, boolean),
  public.add_complex_photo(uuid, text, integer, integer, text, boolean),
  public.reorder_complex_photos(uuid, uuid[]),
  public.remove_complex_photo(uuid, uuid),
  public.add_complex_drawing(uuid, text, integer, integer, text, boolean)
from public, anon;
grant execute on function
  private.locked_complex_status(uuid),
  private.require_rule12(public.publication_status, boolean),
  public.add_complex_photo(uuid, text, integer, integer, text, boolean),
  public.reorder_complex_photos(uuid, uuid[]),
  public.remove_complex_photo(uuid, uuid),
  public.add_complex_drawing(uuid, text, integer, integer, text, boolean)
to authenticated;

-- ─── Блоки: вкладка сохраняется целиком (И4) ─────────────────────────────────────────────
-- Формат: [{id?, name, build_status, progress_pct, floors_total, floors_built, deadline_year,
-- deadline_quarter, finishing_id, cadastre, cadastre_expected_on, currency, price_includes}]
-- в нужном порядке. Блок со списком квартир не удаляется (это шаг 12); удаление блока уносит
-- его планировки — в журнале одна запись о блоке.
create function public.save_complex_blocks(p_complex uuid, p_blocks jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_index integer := 0;
  item_id uuid;
  kept uuid[];
  before text[];
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
  -- Сначала удалённые: новый блок может взять имя удалённого.
  delete from public.blocks b where b.complex_id = p_complex and b.id <> all (kept);

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
    end if;
  end loop;

  perform private.assert_complex_not_worse(p_complex, before);
end;
$$;

comment on function public.save_complex_blocks(uuid, jsonb) is
  'Вкладка «Блоки»: весь список одной транзакцией, порядок — по массиву.';

revoke all on function public.save_complex_blocks(uuid, jsonb) from public, anon;
grant execute on function public.save_complex_blocks(uuid, jsonb) to authenticated;

-- ─── Планировки блока: вкладка сохраняется целиком (И5) ──────────────────────────────────
-- Формат: [{id?, rooms, area, drawing_id, price_from, available}]. Порядок — по комнатам и
-- площади, как на сайте. Чертёж — только этого ЖК. Ответ — пути файлов чертежей, которые больше
-- ни к чему не привязаны: сервер удалит их из бакета.
create function public.save_block_layouts(p_block uuid, p_layouts jsonb)
returns text[]
language plpgsql
set search_path = ''
as $$
declare
  item jsonb;
  item_id uuid;
  drawing uuid;
  complex uuid;
  kept uuid[];
  was_linked uuid[];
  before text[];
  removed text[];
begin
  if not private.has_role('head') then
    raise exception 'Планировки правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_layouts) is distinct from 'array' or jsonb_array_length(p_layouts) > 60 then
    raise exception 'Нужен список до 60 планировок' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select b.complex_id into complex from public.blocks b where b.id = p_block;
  if complex is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.locked_complex_status(complex);
  before := private.complex_missing(complex);
  was_linked := array(select l.drawing_id from public.layouts l where l.block_id = p_block and l.drawing_id is not null);

  kept := array(
    select nullif(value ->> 'id', '')::uuid from jsonb_array_elements(p_layouts)
    where nullif(value ->> 'id', '') is not null
  );
  if exists (
    select 1 from public.units u
    where u.block_id = p_block and u.layout_id is not null and u.layout_id <> all (kept)
  ) then
    raise exception 'На планировку назначены квартиры — сначала поменяйте их стояки'
      using errcode = 'check_violation', hint = 'vh:has_units';
  end if;
  delete from public.layouts l where l.block_id = p_block and l.id <> all (kept);

  for item in select value from jsonb_array_elements(p_layouts) loop
    item_id := nullif(item ->> 'id', '')::uuid;
    drawing := nullif(item ->> 'drawing_id', '')::uuid;
    if drawing is not null and not exists (
      select 1 from public.media_assets m where m.id = drawing and m.complex_id = complex and m.kind = 'drawing'
    ) then
      raise exception 'Чертёж не найден — загрузите его снова' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
    end if;
    if item_id is null then
      insert into public.layouts (block_id, rooms, area, drawing_id, price_from, available)
      values (
        p_block,
        (item ->> 'rooms')::smallint,
        (item ->> 'area')::numeric,
        drawing,
        (item ->> 'price_from')::numeric,
        coalesce((item ->> 'available')::boolean, true)
      );
    else
      update public.layouts
        set rooms = (item ->> 'rooms')::smallint,
            area = (item ->> 'area')::numeric,
            drawing_id = drawing,
            price_from = (item ->> 'price_from')::numeric,
            available = coalesce((item ->> 'available')::boolean, true)
        where id = item_id and block_id = p_block;
      if not found then
        raise exception 'Планировка не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
      end if;
    end if;
  end loop;

  update public.layouts l set sort = x.place * 10
    from (
      select id, row_number() over (order by rooms, area, created_at, id) as place
      from public.layouts where block_id = p_block
    ) x
    where l.id = x.id and l.sort is distinct from (x.place * 10)::integer;

  perform private.assert_complex_not_worse(complex, before);

  -- Отвязанные в этом сохранении и брошенные (загрузили, но вкладку не сохранили) чертежи.
  with gone as (
    delete from public.media_assets m
    where m.complex_id = complex and m.kind = 'drawing'
      and (m.id = any (was_linked) or m.created_at < now() - interval '1 day')
      and not exists (select 1 from public.layouts l where l.drawing_id = m.id)
    returning m.path
  )
  select coalesce(array_agg(path), '{}') into removed from gone;
  return removed;
end;
$$;

comment on function public.save_block_layouts(uuid, jsonb) is
  'Вкладка «Планировки», один блок: весь список одной транзакцией; возвращает пути отвязанных чертежей.';

revoke all on function public.save_block_layouts(uuid, jsonb) from public, anon;
grant execute on function public.save_block_layouts(uuid, jsonb) to authenticated;

-- ─── Логотип и фон застройщика: отметка 1.2 у опубликованного (И8) ───────────────────────
drop function public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real);

create function public.set_developer_media(
  p_developer uuid,
  p_kind public.media_kind,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_focus_x real default 0.5,
  p_focus_y real default 0.5,
  p_rule12 boolean default false
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
  perform private.require_rule12(
    (select d.status from public.developers d where d.id = p_developer), p_rule12);
  delete from public.media_assets
  where developer_id = p_developer and kind = p_kind
  returning path into old_path;
  insert into public.media_assets (developer_id, kind, path, width, height, blur, focus_x, focus_y)
  values (p_developer, p_kind, p_path, p_width, p_height, p_blur, p_focus_x, p_focus_y);
  return old_path;
end;
$$;

comment on function public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real, boolean) is
  'Логотип или фон застройщика: заменяет прежний одной транзакцией, возвращает путь старого файла; у опубликованного — с отметкой правила 1.2.';

revoke all on function
  public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real, boolean)
from public, anon;
grant execute on function
  public.set_developer_media(uuid, public.media_kind, text, integer, integer, text, real, real, boolean)
to authenticated;

-- ─── Журнал ──────────────────────────────────────────────────────────────────────────────
-- Каскад удаления блока: его планировки и квартиры уходят следом, но строки блока уже нет, и
-- привязка к ЖК была бы пустой, а блок на 500 квартир дал бы 500 записей. Запись одна — о блоке.
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
  if tg_op = 'DELETE' and tg_table_name in ('layouts', 'units') and not exists (
    select 1 from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid
  ) then
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

-- Подпись блока и планировки в журнале: «Блок A», «Блок A · 2-комн. · 64,5 м²».
create function private.journal_block_label(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'Блок ' || p_name
$$;

create function private.journal_layout_label(p_block_name text, p_rooms smallint, p_area numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select concat_ws(' · ',
    private.journal_block_label(p_block_name),
    case when p_rooms = 0 then 'Студия' else p_rooms || '-комн.' end,
    replace(trim_scale(p_area)::text, '.', ',') || ' м²')
$$;

-- Новое значение поля из записи журнала: у добавления и удаления — значение, у правки — [было, стало].
create function private.journal_value(p_changes jsonb, p_field text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case jsonb_typeof(p_changes -> p_field)
    when 'array' then coalesce(p_changes -> p_field ->> 1, p_changes -> p_field ->> 0)
    else p_changes ->> p_field
  end
$$;

drop function public.journal_entries(uuid, bigint, integer);

-- Журнал для кабинета: застройщик, ЖК или всё подряд («Настройки → Журнал»), страницами от
-- новых к старым. Права — RLS журнала (руководитель и менеджер); имя автора — из profiles.
-- subject — о ком запись: блок и планировка — своей подписью, сданный объект — названием,
-- застройщик, ЖК, сотрудник по текущему названию, иначе — название из самой записи.
create function public.journal_entries(
  p_developer uuid default null,
  p_before bigint default null,
  p_limit integer default 50,
  p_complex uuid default null
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
           case when a.entity = 'blocks' then private.journal_block_label(coalesce(
             (select b.name from public.blocks b where b.id::text = a.entity_id),
             private.journal_value(a.changes, 'name')))
           end,
           case when a.entity = 'layouts' then coalesce(
             (select private.journal_layout_label(b.name, l.rooms, l.area)
                from public.layouts l join public.blocks b on b.id = l.block_id
               where l.id::text = a.entity_id),
             (select private.journal_layout_label(
                       b.name,
                       private.journal_value(a.changes, 'rooms')::smallint,
                       private.journal_value(a.changes, 'area')::numeric)
                from public.blocks b where b.id::text = private.journal_value(a.changes, 'block_id')))
           end,
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
    and (p_complex is null or a.complex_id = p_complex)
    and (p_before is null or a.id < p_before)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;

comment on function public.journal_entries(uuid, bigint, integer, uuid) is
  'Журнал изменений для кабинета: по застройщику, по ЖК или весь, страницами (p_before — id последней строки).';

revoke all on function
  private.journal_block_label(text),
  private.journal_layout_label(text, smallint, numeric),
  private.journal_value(jsonb, text),
  public.journal_entries(uuid, bigint, integer, uuid)
from public, anon;
grant execute on function
  private.journal_block_label(text),
  private.journal_layout_label(text, smallint, numeric),
  private.journal_value(jsonb, text),
  public.journal_entries(uuid, bigint, integer, uuid)
to authenticated;

-- ─── Адрес на сайте у ещё не опубликованного ЖК («реши сам» шага 11) ─────────────────────
-- Пока ЖК ни разу не публиковался (отметки 1.2 ещё не было), адрес следует за UZ-названием —
-- опечатка черновика не остаётся в адресе навсегда. После первой публикации адрес не меняется:
-- ссылки на сайте не ломаются. Ответ — адрес ЖК после вызова.
create function public.set_complex_slug(p_complex uuid, p_slug text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  current_slug text;
  ever_published boolean;
  candidate text := p_slug;
  suffix integer := 1;
begin
  if not private.has_role('head') then
    raise exception 'Адрес ЖК меняет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select c.slug, c.files_checked_at is not null into current_slug, ever_published
    from public.complexes c where c.id = p_complex for update;
  if current_slug is null then
    raise exception 'ЖК не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if ever_published or p_slug ~ '^demo(-|$)' or current_slug ~ '^demo(-|$)'
     or current_slug = p_slug or current_slug ~ ('^' || p_slug || '-[0-9]+$') then
    return current_slug;
  end if;
  loop
    begin
      update public.complexes set slug = candidate where id = p_complex;
      return candidate;
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

comment on function public.set_complex_slug(uuid, text) is
  'Адрес на сайте по UZ-названию — только у ЖК, который ещё ни разу не публиковался.';

revoke all on function public.set_complex_slug(uuid, text) from public, anon;
grant execute on function public.set_complex_slug(uuid, text) to authenticated;
