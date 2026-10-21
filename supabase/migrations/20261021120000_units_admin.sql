-- Фаза 1 · шаг 12.1: квартиры и наличие в кабинете (решения Н1–Н7, 21.10.2026).
-- Список квартир блока правится только функциями: генератор, правка строки, «+ Квартира»,
-- удаление, массовые статус, цена, отделка и стояки, «Отменить», «нет в наличии» (Н7).
-- Так предел 5000, этажность блока, замок ЖК и одна запись журнала на действие держатся на
-- любом пути, а не только в кабинете. Публичные функции наличия не меняются.

-- ─── Этаж квартиры ───────────────────────────────────────────────────────────────────────
-- Квартиры — с первого этажа: генератор (firstResidentialFloor ≥ 1) и функции ниже держат ту же
-- границу, иначе у таблицы, кода и формы было бы три разные правды.
alter table public.units
  drop constraint units_floor_check,
  add constraint units_floor_check check (floor between 1 and 100);

-- ─── Замок ЖК ────────────────────────────────────────────────────────────────────────────
-- Писатели вкладок ЖК (шаг 11) и квартир по-прежнему идут друг за другом (вкладки кабинета берут
-- тот же замок). Не ждут конца генерации или массовой правки только вставки без замка ЖК со
-- ссылкой на него — заявки сайта фазы 3.
create or replace function private.locked_complex_status(p_complex uuid)
returns public.publication_status
language plpgsql
set search_path = ''
as $$
declare
  current_status public.publication_status;
begin
  select c.status into current_status from public.complexes c where c.id = p_complex for no key update;
  if current_status is null then
    raise exception 'ЖК не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return current_status;
end;
$$;

-- ─── Прямая запись в квартиры закрыта ────────────────────────────────────────────────────
-- Права по PLAN §5 те же (руководитель — всё, менеджер — статус), меняется путь: только функции
-- ниже. Каскады внешних ключей и DEMO-сид работают от владельца таблицы.
drop policy "units: добавляет руководитель" on public.units;
drop policy "units: правит руководитель" on public.units;
drop policy "units: удаляет руководитель" on public.units;
revoke insert, update, delete on public.units from authenticated;

-- ─── Журнал квартир: одна запись на действие ─────────────────────────────────────────────
-- Пакетная функция ставит флаг на время одного своего оператора по units и пишет сводку сама.
-- Условие WHEN проверяется в момент изменения строки: при флаге событие даже не ставится в
-- очередь — 5000 квартир генератора не дают 5000 вызовов write_audit.
drop trigger units_audit on public.units;
create trigger units_audit after insert or update or delete on public.units
  for each row when (current_setting('vodiy.units_summary', true) is distinct from 'on')
  execute function private.write_audit();

-- ─── Хелперы ─────────────────────────────────────────────────────────────────────────────

-- Предел квартир в блоке — единственное место числа в SQL; тест сверяет его с
-- BLOCK_PLAN_LIMITS.totalUnits (lib/units/blockPlan.ts).
create function private.unit_limit()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 5000
$$;

-- Номер — как в ограничении таблицы units, после обрезки пробелов: «12», «12А», «3/1».
create function private.is_unit_number(p_number text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p_number) ~ '^[0-9A-Za-zА-Яа-я/-]{1,10}$', false)
$$;

-- Блокирует строку ЖК, как вкладки шага 11: правки одного ЖК идут друг за другом, а
-- взаимной блокировки нет — все писатели берут сначала ЖК, потом строки. Ответ — id ЖК.
create function private.lock_units_block(p_block uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  complex uuid;
begin
  select b.complex_id into complex from public.blocks b where b.id = p_block;
  if complex is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.locked_complex_status(complex);
  -- Пока ждали замок, блок могли удалить вкладкой «Блоки»: следующий оператор видит новый снимок.
  if not exists (select 1 from public.blocks b where b.id = p_block) then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return complex;
end;
$$;

-- Выбранные квартиры — все из этого блока, иначе отказ целиком: часть изменений по
-- устаревшему списку хуже, чем «обновите список». Ответ — без пустых и повторов.
create function private.block_unit_ids(p_block uuid, p_ids uuid[])
returns uuid[]
language plpgsql
set search_path = ''
as $$
declare
  ids uuid[];
  missing integer;
begin
  ids := array(select distinct x.id from unnest(coalesce(p_ids, '{}')) as x (id) where x.id is not null);
  if cardinality(ids) > private.unit_limit() then
    raise exception 'Слишком много квартир за раз' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select count(*) into missing
    from unnest(ids) as x (id)
    where not exists (select 1 from public.units u where u.id = x.id and u.block_id = p_block);
  if missing > 0 then
    raise exception 'Квартиры уже нет — обновите список'
      using errcode = 'no_data_found', hint = 'vh:not_found', detail = missing::text;
  end if;
  return ids;
end;
$$;

-- Пара обрамляет ровно один оператор по units. Флаг живёт до конца транзакции, а не функции:
-- не вернуть его — значит молча выключить журнал квартир для следующих правок той же транзакции.
-- Возвращаем прежнее значение, а не 'off': вызовы могут оказаться вложенными.
create function private.mute_unit_rows()
returns text
language plpgsql
set search_path = ''
as $$
declare
  previous text := current_setting('vodiy.units_summary', true);
begin
  perform set_config('vodiy.units_summary', 'on', true);
  return previous;
end;
$$;

create function private.unmute_unit_rows(p_previous text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('vodiy.units_summary', coalesce(p_previous, ''), true);
end;
$$;

-- Номера для журнала: «1–180» для сплошного ряда, иначе «41, 42, 43 и ещё 7» по порядку номеров
-- (2 < 10 < 12А). p_limit null — все номера (брони и продажи при удалении). Числом считается
-- только номер без ведущих нулей: «1», «01», «3» — не ряд «1–3».
create function private.unit_numbers_label(p_numbers text[], p_limit integer default 20)
returns text
language sql
immutable
set search_path = ''
as $$
  with numbers as (
    select
      n,
      case when n ~ '^[1-9][0-9]*$' then n::numeric end as value,
      row_number() over (order by nullif(substring(n from '^[0-9]+'), '')::numeric nulls last, n) as place
    from unnest(p_numbers) as t (n)
    where n is not null
  ),
  stats as (
    select count(*) as total, count(value) as digits, count(distinct n) as unique_total,
           min(value) as low, max(value) as high
    from numbers
  )
  select case
    when s.total = 0 then null
    when s.total > 2 and s.digits = s.total and s.unique_total = s.total and s.high - s.low + 1 = s.total
      then s.low::text || '–' || s.high::text
    else (select string_agg(x.n, ', ' order by x.place) from numbers x where p_limit is null or x.place <= p_limit)
      || case when p_limit is not null and s.total > p_limit then ' и ещё ' || (s.total - p_limit) else '' end
  end
  from stats s
$$;

-- Подпись планировки без блока: «1-комн. · 42,5 м²».
create function private.layout_label(p_layout uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select private.journal_layout_label(null, l.rooms, l.area) from public.layouts l where l.id = p_layout
$$;

-- Подпись квартиры в журнале: «Блок A · кв. 41»; без номера — «Блок A».
create function private.journal_unit_label(p_block_name text, p_number text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(concat_ws(' · ', private.journal_block_label(p_block_name), 'кв. ' || p_number), '')
$$;

-- Значение поля, общее у всех строк, иначе null: «было» в паре сводки («свободна → бронь»,
-- а у смешанной выборки — «— → бронь»).
create function private.common_value(p_rows jsonb, p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when count(distinct coalesce(r -> p_key, 'null'::jsonb)) = 1
    then nullif((array_agg(coalesce(r -> p_key, 'null'::jsonb)))[1], 'null'::jsonb)
  end
  from jsonb_array_elements(p_rows) as r
$$;

-- Цена квартиры: целиком или за м² (Н3), ровно одна из двух или ни одной. Таблица пропускает 0
-- (на сайте было бы «$0») — функции нет. Больше двух знаков после запятой — отказ, а не тихое
-- округление колонкой: 0,004 стало бы «$0», а журнал записал бы цену, которой нет. Цена за м² —
-- до 10⁹: площадь × цена м² (до 999,99 м²) должна влезать в «цену от» планировки.
create function private.unit_price_columns(p_mode text, p_value numeric, out total numeric, out per_m2 numeric)
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_mode = 'none' and p_value is null then
    return;
  elsif p_value = round(p_value, 2) and p_value > 0 then
    if p_mode = 'total' and p_value < 1e12 then
      total := p_value;
      return;
    elsif p_mode = 'per_m2' and p_value < 1e9 then
      per_m2 := p_value;
      return;
    end if;
  end if;
  raise exception 'Цена — число больше нуля' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'price';
end;
$$;

-- Отделка квартиры: пусто — «как в блоке», иначе действующее значение справочника.
create function private.check_unit_finishing(p_finishing smallint)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_finishing is not null and not exists (
    select 1 from public.finishings f where f.id = p_finishing and f.is_active
  ) then
    raise exception 'Такой отделки нет в справочнике' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'finishing_id';
  end if;
end;
$$;

-- Единственное место формата сводной записи: entity 'units', entity_id — блок, complex_id —
-- всегда (иначе запись не видна во вкладке «Журнал» ЖК и переживает demo:remove). Видимые
-- пары [было, стало] — сверху, подробности — в объекте summary: массив из двух номеров на
-- верхнем уровне журнал кабинета принял бы за «было → стало».
create function private.write_units_summary(
  p_block uuid,
  p_action public.audit_action,
  p_pairs jsonb,
  p_summary jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  complex uuid;
  block_name text;
  block_currency public.currency;
begin
  if current_setting('vodiy.skip_audit', true) = 'on' or coalesce((p_summary ->> 'count')::integer, 0) = 0 then
    return;
  end if;
  select b.complex_id, b.name, b.currency into complex, block_name, block_currency
    from public.blocks b where b.id = p_block;
  if complex is null then
    raise exception 'Сводка журнала квартир без ЖК: блок %', p_block;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, developer_id, changes)
  values (
    (select auth.uid()),
    p_action,
    'units',
    p_block::text,
    complex,
    null,
    jsonb_build_object('block_id', p_block, 'block_name', block_name, 'currency', block_currency)
      || coalesce(p_pairs, '{}') || jsonb_build_object('summary', p_summary)
  );
end;
$$;

revoke all on function
  private.unit_limit(),
  private.is_unit_number(text),
  private.lock_units_block(uuid),
  private.block_unit_ids(uuid, uuid[]),
  private.mute_unit_rows(),
  private.unmute_unit_rows(text),
  private.unit_numbers_label(text[], integer),
  private.layout_label(uuid),
  private.journal_unit_label(text, text),
  private.common_value(jsonb, text),
  private.unit_price_columns(text, numeric),
  private.check_unit_finishing(smallint),
  private.write_units_summary(uuid, public.audit_action, jsonb, jsonb)
from public, anon;
-- Подпись квартиры зовёт journal_entries (security invoker), как подписи блока и планировки.
grant execute on function private.journal_unit_label(text, text) to authenticated;

-- ─── Чтение для кабинета ─────────────────────────────────────────────────────────────────
-- Список квартир блока одним значением: PostgREST отдаёт не больше 1000 строк (max_rows), а
-- в блоке до 5000 квартир — «Выбрать все N» и стояки по обрезанному списку молча задели бы часть.
-- Имя того, кто менял последним, — из profiles (менеджер чужие профили не читает).
create function public.block_unit_rows(p_block uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', u.id,
      'entrance', u.entrance,
      'floor', u.floor,
      'position', u."position",
      'number', u.number,
      'layout_id', u.layout_id,
      'price', u.price,
      'price_per_m2', u.price_per_m2,
      'finishing_id', u.finishing_id,
      'status', u.status,
      'updated_at', u.updated_at,
      'updated_by_name', p.full_name
    ) order by nullif(substring(u.number from '^[0-9]+'), '')::numeric nulls last, u.number), '[]')
  from public.units u
  left join public.profiles p on p.id = u.updated_by
  where u.block_id = p_block and private.is_staff()
$$;

comment on function public.block_unit_rows(uuid) is
  'Квартиры блока для кабинета (сотрудникам) одним jsonb — без предела строк PostgREST; по порядку номеров.';

-- ─── Генератор: список блока одной транзакцией (Н6) ──────────────────────────────────────
-- Строки считает lib/units (generateUnits + applyRisers) — логика нумерации и стояков не
-- дублируется в SQL; база проверяет инварианты. Формат: [{entrance, floor, position, number,
-- layout_id}]. Второй раз на блок со списком — отказ: список правят, а не генерируют заново.
create function public.create_block_units(p_block uuid, p_units jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  floors smallint;
  bad integer;
  before text[];
  previous text;
  created text[];
  unassigned integer;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_units) is distinct from 'array' or jsonb_array_length(p_units) = 0 then
    raise exception 'Нужен список квартир' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if jsonb_array_length(p_units) > private.unit_limit() then
    raise exception 'В блоке не больше % квартир', private.unit_limit()
      using errcode = 'check_violation', hint = 'vh:units_limit';
  end if;
  complex := private.lock_units_block(p_block);
  -- После замка: второй одновременный генератор получает понятный отказ, а не смешанный список.
  if exists (select 1 from public.units u where u.block_id = p_block) then
    raise exception 'У блока уже есть список квартир — обновите страницу'
      using errcode = 'check_violation', hint = 'vh:list_exists';
  end if;
  select b.floors_total into floors from public.blocks b where b.id = p_block;
  if floors is null then
    raise exception 'У блока нет этажности — укажите её на вкладке «Блоки»'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'floors_total';
  end if;

  -- integer, а не smallint: выход за предел — понятный отказ, а не ошибка преобразования.
  select count(*) into bad
  from jsonb_to_recordset(p_units) as r (entrance integer, floor integer, "position" integer, number text, layout_id uuid)
  where r.entrance is null or r.entrance not between 1 and 50
     or r."position" is null or r."position" not between 1 and 50
     or r.floor is null or r.floor not between 1 and floors
     or not private.is_unit_number(r.number)
     or (r.layout_id is not null and not exists (
       select 1 from public.layouts l where l.id = r.layout_id and l.block_id = p_block));
  if bad > 0 then
    raise exception 'Список квартир не подходит блоку — обновите страницу'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = bad::text;
  end if;

  before := private.complex_missing(complex);
  previous := private.mute_unit_rows();
  with inserted as (
    insert into public.units (block_id, layout_id, entrance, floor, "position", number)
    select p_block, r.layout_id, r.entrance, r.floor, r."position", btrim(r.number)
    from jsonb_to_recordset(p_units) as r (entrance integer, floor integer, "position" integer, number text, layout_id uuid)
    returning units.number, units.layout_id
  )
  select array_agg(i.number), count(*) filter (where i.layout_id is null) into created, unassigned
    from inserted i;
  perform private.unmute_unit_rows(previous);

  -- Опубликованный ЖК: список без стояков снял бы «цену от» с планировки — отказ.
  perform private.assert_complex_not_worse(complex, before);
  perform private.write_units_summary(p_block, 'insert', '{}', jsonb_build_object(
    'kind', 'create', 'count', cardinality(created), 'numbers', private.unit_numbers_label(created),
    'unassigned', unassigned));
  return jsonb_build_object('complex_id', complex, 'created', cardinality(created), 'unassigned', unassigned);
end;
$$;

comment on function public.create_block_units(uuid, jsonb) is
  'Генератор (Н6): список квартир блока одной транзакцией из строк lib/units; одна запись в журнале.';

-- ─── Правка списка руководителем (Н4) ────────────────────────────────────────────────────

-- «+ Квартира»: свободная, без цены. Только в блок со списком — одна квартира иначе переключила
-- бы блок на сайте с ручных флагов «доступна» на подсчёт квартир.
create function public.add_unit(
  p_block uuid,
  p_entrance integer,
  p_floor integer,
  p_position integer,
  p_number text,
  p_layout uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  floors smallint;
  unit_row public.units;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  complex := private.lock_units_block(p_block);
  if not exists (select 1 from public.units u where u.block_id = p_block) then
    raise exception 'У блока нет списка квартир — создайте его генератором'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'no_list';
  end if;
  if (select count(*) from public.units u where u.block_id = p_block) >= private.unit_limit() then
    raise exception 'В блоке не больше % квартир', private.unit_limit()
      using errcode = 'check_violation', hint = 'vh:units_limit';
  end if;
  select b.floors_total into floors from public.blocks b where b.id = p_block;
  if floors is null or p_floor is null or p_floor not between 1 and floors
     or p_entrance is null or p_entrance not between 1 and 50
     or p_position is null or p_position not between 1 and 50 then
    raise exception 'Подъезд, этаж или позиция вне блока' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'slot';
  end if;
  if not private.is_unit_number(p_number) then
    raise exception 'Номер — до 10 букв и цифр' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'number';
  end if;
  if exists (select 1 from public.units u where u.block_id = p_block and u.number = btrim(p_number)) then
    raise exception 'Квартира с таким номером уже есть' using errcode = 'unique_violation', hint = 'vh:unit_taken', detail = 'number';
  end if;
  if exists (
    select 1 from public.units u
    where u.block_id = p_block and u.entrance = p_entrance and u.floor = p_floor and u."position" = p_position
  ) then
    raise exception 'Это место на этаже уже занято' using errcode = 'unique_violation', hint = 'vh:unit_taken', detail = 'slot';
  end if;
  if p_layout is not null and not exists (
    select 1 from public.layouts l where l.id = p_layout and l.block_id = p_block
  ) then
    raise exception 'Планировка не из этого блока' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'layout_id';
  end if;

  insert into public.units (block_id, layout_id, entrance, floor, "position", number)
  values (p_block, p_layout, p_entrance, p_floor, p_position, btrim(p_number))
  returning * into unit_row;
  return jsonb_build_object('complex_id', complex, 'unit', to_jsonb(unit_row));
end;
$$;

-- Правка строки: меняются только переданные ключи {number, layout_id, price: {mode, value},
-- finishing_id} — правка номера не затирает цену, которую минуту назад поставили массово.
-- Статус здесь не меняется: только set_units_status.
create function public.update_unit(p_block uuid, p_unit uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  unit_row public.units;
  new_number text;
  new_layout uuid;
  new_total numeric;
  new_per_m2 numeric;
  new_finishing smallint;
  before text[];
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_patch) as k (key)
    where k.key not in ('number', 'layout_id', 'price', 'finishing_id')
  ) then
    raise exception 'Неизвестное поле квартиры' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  complex := private.lock_units_block(p_block);
  select * into unit_row from public.units u where u.id = p_unit and u.block_id = p_block;
  if not found then
    raise exception 'Квартиры уже нет — обновите список' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  new_number := unit_row.number;
  new_layout := unit_row.layout_id;
  new_total := unit_row.price;
  new_per_m2 := unit_row.price_per_m2;
  new_finishing := unit_row.finishing_id;

  if p_patch ? 'number' then
    if not private.is_unit_number(p_patch ->> 'number') then
      raise exception 'Номер — до 10 букв и цифр' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'number';
    end if;
    new_number := btrim(p_patch ->> 'number');
    if exists (select 1 from public.units u where u.block_id = p_block and u.number = new_number and u.id <> p_unit) then
      raise exception 'Квартира с таким номером уже есть' using errcode = 'unique_violation', hint = 'vh:unit_taken', detail = 'number';
    end if;
  end if;
  if p_patch ? 'layout_id' then
    new_layout := nullif(p_patch ->> 'layout_id', '')::uuid;
    if new_layout is not null and not exists (
      select 1 from public.layouts l where l.id = new_layout and l.block_id = p_block
    ) then
      raise exception 'Планировка не из этого блока' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'layout_id';
    end if;
  end if;
  if p_patch ? 'price' then
    select c.total, c.per_m2 into new_total, new_per_m2
      from private.unit_price_columns(p_patch -> 'price' ->> 'mode', (p_patch -> 'price' ->> 'value')::numeric) c;
  end if;
  if p_patch ? 'finishing_id' then
    new_finishing := nullif(p_patch ->> 'finishing_id', '')::smallint;
    -- Скрытая отделка, что уже стоит у квартиры, остаётся: правка другого поля её не сбрасывает.
    if new_finishing is distinct from unit_row.finishing_id then
      perform private.check_unit_finishing(new_finishing);
    end if;
  end if;

  before := private.complex_missing(complex);
  update public.units u
    set number = new_number, layout_id = new_layout, price = new_total, price_per_m2 = new_per_m2,
        finishing_id = new_finishing
    where u.id = p_unit
      and (u.number, u.layout_id, u.price, u.price_per_m2, u.finishing_id)
        is distinct from (new_number, new_layout, new_total, new_per_m2, new_finishing);
  -- Стёртая цена или другая планировка могут снять с опубликованного ЖК «цену от».
  perform private.assert_complex_not_worse(complex, before);
  select * into unit_row from public.units u where u.id = p_unit;
  return jsonb_build_object('complex_id', complex, 'unit', to_jsonb(unit_row));
end;
$$;

-- «Удалить» выделенные. Весь список так не удаляется — его потерю подтверждают названием блока.
create function public.delete_units(p_block uuid, p_unit_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  ids uuid[];
  before text[];
  previous text;
  gone jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if coalesce(cardinality(p_unit_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'deleted', 0);
  end if;
  complex := private.lock_units_block(p_block);
  ids := private.block_unit_ids(p_block, p_unit_ids);
  if cardinality(ids) = (select count(*) from public.units u where u.block_id = p_block) then
    raise exception 'Весь список удаляется кнопкой «Удалить список блока»'
      using errcode = 'check_violation', hint = 'vh:whole_list';
  end if;

  before := private.complex_missing(complex);
  previous := private.mute_unit_rows();
  with removed as (
    delete from public.units u where u.block_id = p_block and u.id = any (ids)
    returning u.number, u.status
  )
  select coalesce(jsonb_agg(jsonb_build_object('number', r.number, 'status', r.status)), '[]') into gone
    from removed r;
  perform private.unmute_unit_rows(previous);

  perform private.assert_complex_not_worse(complex, before);
  perform private.write_units_summary(p_block, 'delete', '{}', private.removed_units_summary('delete', gone));
  return jsonb_build_object('complex_id', complex, 'deleted', jsonb_array_length(gone));
end;
$$;

-- «Удалить список блока» вводом названия (Н4) → генератор снова доступен. Название Next
-- сравнивает мягко (регистр, A ↔ А) и передаёт прочитанное из базы; база ловит переименование
-- за это время и вызов без подтверждения. Наличие планировок переходит в ручной режим тем же,
-- что сайт показывал до удаления (формула private.layout_offers): «доступна» — была ли свободная,
-- «цена от» — минимальная цена свободной квартиры, а без неё — прежняя ручная.
create function public.delete_block_units(p_block uuid, p_confirm_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  before text[];
  previous text;
  gone jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  complex := private.lock_units_block(p_block);
  if btrim(p_confirm_name) is distinct from (select b.name from public.blocks b where b.id = p_block) then
    raise exception 'Название блока не совпадает' using errcode = 'invalid_parameter_value', hint = 'vh:confirm_name';
  end if;
  if not exists (select 1 from public.units u where u.block_id = p_block) then
    raise exception 'Списка квартир уже нет — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;

  before := private.complex_missing(complex);
  update public.layouts l
    set available = x.has_free, price_from = coalesce(x.min_price, l.price_from)
    from (
      select
        lo.id,
        exists (select 1 from public.units u where u.layout_id = lo.id and u.status = 'free') as has_free,
        (select min(coalesce(u.price, u.price_per_m2 * lo.area)) from public.units u
          where u.layout_id = lo.id and u.status = 'free') as min_price
      from public.layouts lo
      where lo.block_id = p_block
    ) x
    where l.id = x.id
      and (l.available, l.price_from) is distinct from (x.has_free, coalesce(x.min_price, l.price_from));

  previous := private.mute_unit_rows();
  with removed as (
    delete from public.units u where u.block_id = p_block returning u.number, u.status
  )
  select coalesce(jsonb_agg(jsonb_build_object('number', r.number, 'status', r.status)), '[]') into gone
    from removed r;
  perform private.unmute_unit_rows(previous);

  perform private.assert_complex_not_worse(complex, before);
  perform private.write_units_summary(p_block, 'delete', '{}', private.removed_units_summary('delete_list', gone));
  return jsonb_build_object('complex_id', complex, 'deleted', jsonb_array_length(gone));
end;
$$;

-- Сводка удаления: сколько и какие; номера брони и продаж — полностью, до CSV фазы 3 это
-- единственный след статусов. p_gone — [{number, status}].
create function private.removed_units_summary(p_kind text, p_gone jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'kind', p_kind,
    'count', count(*),
    'numbers', private.unit_numbers_label(array_agg(g ->> 'number')),
    'statuses', jsonb_build_object(
      'free', count(*) filter (where g ->> 'status' = 'free'),
      'reserved', count(*) filter (where g ->> 'status' = 'reserved'),
      'sold', count(*) filter (where g ->> 'status' = 'sold')),
    'reserved_numbers', private.unit_numbers_label(array_agg(g ->> 'number') filter (where g ->> 'status' = 'reserved'), null),
    'sold_numbers', private.unit_numbers_label(array_agg(g ->> 'number') filter (where g ->> 'status' = 'sold'), null)
  )
  from jsonb_array_elements(p_gone) as g
$$;

revoke all on function private.removed_units_summary(text, jsonb) from public, anon;

-- ─── Статус: тап и массово (решение №7) ──────────────────────────────────────────────────
-- Прежняя функция без блока писала по записи журнала на квартиру — убираем, чтобы PostgREST
-- не выбирал между перегрузками.
drop function public.set_units_status(uuid[], public.unit_status);

-- Ответ undo — прежние статусы группами [{status, ids}] для «Отменить» 5 с. Проверки «не
-- делает хуже» нет: продать последнюю свободную квартиру можно всегда.
create function public.set_units_status(p_block uuid, p_unit_ids uuid[], p_status public.unit_status)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  ids uuid[];
  previous text;
  changed_rows jsonb;
  undo jsonb;
  groups jsonb;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Статус квартир меняют руководитель и менеджер'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_status is null then
    raise exception 'Нужен статус' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if coalesce(cardinality(p_unit_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'changed', 0, 'undo', '[]'::jsonb);
  end if;
  complex := private.lock_units_block(p_block);
  ids := private.block_unit_ids(p_block, p_unit_ids);

  -- Под замком ЖК прежние значения точные.
  previous := private.mute_unit_rows();
  with prev as (
    select u.id, u.status as was, u.number as label
    from public.units u
    where u.block_id = p_block and u.id = any (ids) and u.status <> p_status
  ),
  done as (
    update public.units u set status = p_status from prev where u.id = prev.id
    returning prev.id, prev.was, prev.label
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'was', d.was, 'number', d.label)), '[]')
    into changed_rows from done d;
  perform private.unmute_unit_rows(previous);

  select
    coalesce(jsonb_agg(jsonb_build_object('status', g.was, 'ids', g.unit_ids) order by g.was), '[]'),
    coalesce(jsonb_agg(jsonb_build_object(
      'from', g.was, 'to', p_status, 'count', g.total, 'numbers', private.unit_numbers_label(g.labels)
    ) order by g.was), '[]')
    into undo, groups
  from (
    select x ->> 'was' as was, array_agg(x ->> 'id') as unit_ids, array_agg(x ->> 'number') as labels, count(*) as total
    from jsonb_array_elements(changed_rows) as x
    group by x ->> 'was'
  ) g;

  perform private.write_units_summary(p_block, 'update',
    jsonb_build_object('status', jsonb_build_array(private.common_value(changed_rows, 'was'), p_status)),
    jsonb_build_object(
      'kind', 'status', 'count', jsonb_array_length(changed_rows),
      'numbers', private.unit_numbers_label(array(select x ->> 'number' from jsonb_array_elements(changed_rows) as x)),
      'groups', groups));
  return jsonb_build_object('complex_id', complex, 'changed', jsonb_array_length(changed_rows), 'undo', undo);
end;
$$;

-- «Отменить» 5 с: p_status — статус, который ставили, p_undo — undo из ответа set_units_status.
-- «Сравнить и записать»: квартиру, которую за эти секунды поменял другой сотрудник, не трогаем —
-- её номер уходит в skipped; удалённые за это время считает missing. Исходная запись журнала
-- остаётся: журнал дописывается.
create function public.revert_units_status(p_block uuid, p_status public.unit_status, p_undo jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  wanted_ids uuid[];
  wanted_statuses public.unit_status[];
  previous text;
  changed_rows jsonb;
  skipped text[];
  missing integer;
  groups jsonb;
  common_back jsonb;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Статус квартир меняют руководитель и менеджер'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_status is null or jsonb_typeof(p_undo) is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(p_undo) as g
    where jsonb_typeof(g) is distinct from 'object' or jsonb_typeof(g -> 'ids') is distinct from 'array'
      or g ->> 'status' is null or g ->> 'status' = p_status::text
  ) then
    raise exception 'Нечего отменять — обновите список' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select array_agg(w.id), array_agg(w.status) into wanted_ids, wanted_statuses
  from (
    select x.id::uuid as id, (g ->> 'status')::public.unit_status as status
    from jsonb_array_elements(p_undo) as g
    cross join lateral jsonb_array_elements_text(g -> 'ids') as x (id)
  ) w;
  if coalesce(cardinality(wanted_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'reverted', 0, 'skipped', '[]'::jsonb, 'missing', 0);
  end if;
  if cardinality(wanted_ids) > private.unit_limit()
     or cardinality(wanted_ids) <> (select count(distinct x) from unnest(wanted_ids) as x) then
    raise exception 'Нечего отменять — обновите список' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  complex := private.lock_units_block(p_block);

  previous := private.mute_unit_rows();
  with done as (
    update public.units u set status = w.status
    from unnest(wanted_ids, wanted_statuses) as w (id, status)
    where u.id = w.id and u.block_id = p_block and u.status = p_status
    returning u.id, w.status as back, u.number as label
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'back', d.back, 'number', d.label)), '[]')
    into changed_rows from done d;
  perform private.unmute_unit_rows(previous);

  skipped := array(
    select u.number
    from unnest(wanted_ids, wanted_statuses) as w (id, status)
    join public.units u on u.id = w.id and u.block_id = p_block
    where u.status <> w.status
    order by nullif(substring(u.number from '^[0-9]+'), '')::numeric nulls last, u.number
  );
  select count(*) into missing
    from unnest(wanted_ids) as w (id)
    where not exists (select 1 from public.units u where u.id = w.id and u.block_id = p_block);
  select coalesce(jsonb_agg(jsonb_build_object(
      'from', p_status, 'to', g.back, 'count', g.total, 'numbers', private.unit_numbers_label(g.labels)
    ) order by g.back), '[]')
    into groups
  from (
    select x ->> 'back' as back, array_agg(x ->> 'number') as labels, count(*) as total
    from jsonb_array_elements(changed_rows) as x
    group by x ->> 'back'
  ) g;

  -- Пара — только при общем «стало»: «бронь → —» читалось бы как «статус сняли».
  common_back := private.common_value(changed_rows, 'back');
  perform private.write_units_summary(p_block, 'update',
    case when common_back is not null then jsonb_build_object('status', jsonb_build_array(p_status, common_back)) end,
    jsonb_build_object(
      'kind', 'status', 'undo', true, 'count', jsonb_array_length(changed_rows),
      'numbers', private.unit_numbers_label(array(select x ->> 'number' from jsonb_array_elements(changed_rows) as x)),
      'groups', groups, 'skipped', cardinality(skipped), 'missing', missing));
  return jsonb_build_object(
    'complex_id', complex, 'reverted', jsonb_array_length(changed_rows), 'skipped', to_jsonb(skipped),
    'missing', missing);
end;
$$;

-- ─── Массовые цена и отделка (решение №7, Н3) ────────────────────────────────────────────

-- Цена ставится и брони, и проданным: в кабинете она серая, сайту её не отдают функции наличия.
-- Цена за м² у квартиры без планировки разрешена (на сайте «по запросу», пока стояк не назначит
-- планировку) — ответ without_layout для предупреждения на экране.
create function public.set_units_price(p_block uuid, p_unit_ids uuid[], p_mode text, p_value numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  ids uuid[];
  new_total numeric;
  new_per_m2 numeric;
  before text[];
  previous text;
  changed_rows jsonb;
  pairs jsonb := '{}';
  without_layout integer := 0;
begin
  if not private.has_role('head') then
    raise exception 'Цены квартир правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select c.total, c.per_m2 into new_total, new_per_m2 from private.unit_price_columns(p_mode, p_value) c;
  if coalesce(cardinality(p_unit_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'changed', 0, 'without_layout', 0);
  end if;
  complex := private.lock_units_block(p_block);
  ids := private.block_unit_ids(p_block, p_unit_ids);
  if p_mode = 'per_m2' then
    select count(*) into without_layout from public.units u where u.id = any (ids) and u.layout_id is null;
  end if;

  before := private.complex_missing(complex);
  previous := private.mute_unit_rows();
  with prev as (
    select u.id, u.price as old_total, u.price_per_m2 as old_per_m2, u.number as label
    from public.units u
    where u.block_id = p_block and u.id = any (ids)
      and (u.price, u.price_per_m2) is distinct from (new_total, new_per_m2)
  ),
  done as (
    update public.units u set price = new_total, price_per_m2 = new_per_m2 from prev where u.id = prev.id
    returning prev.old_total, prev.old_per_m2, prev.label
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'price', d.old_total, 'price_per_m2', d.old_per_m2, 'number', d.label)), '[]')
    into changed_rows from done d;
  perform private.unmute_unit_rows(previous);

  -- Снятая единственная цена может убрать с опубликованного ЖК «цену от».
  perform private.assert_complex_not_worse(complex, before);
  -- Пара — только у поля, которое изменилось хотя бы у одной квартиры.
  if exists (select 1 from jsonb_array_elements(changed_rows) as x where (x ->> 'price')::numeric is distinct from new_total) then
    pairs := pairs || jsonb_build_object('price', jsonb_build_array(private.common_value(changed_rows, 'price'), new_total));
  end if;
  if exists (select 1 from jsonb_array_elements(changed_rows) as x where (x ->> 'price_per_m2')::numeric is distinct from new_per_m2) then
    pairs := pairs || jsonb_build_object('price_per_m2', jsonb_build_array(private.common_value(changed_rows, 'price_per_m2'), new_per_m2));
  end if;
  perform private.write_units_summary(p_block, 'update', pairs, jsonb_build_object(
    'kind', 'price', 'mode', p_mode, 'value', p_value, 'count', jsonb_array_length(changed_rows),
    'numbers', private.unit_numbers_label(array(select x ->> 'number' from jsonb_array_elements(changed_rows) as x)),
    'without_layout', without_layout));
  return jsonb_build_object('complex_id', complex, 'changed', jsonb_array_length(changed_rows), 'without_layout', without_layout);
end;
$$;

-- Отделка: пусто — «как в блоке». На готовность ЖК не влияет.
create function public.set_units_finishing(p_block uuid, p_unit_ids uuid[], p_finishing smallint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  ids uuid[];
  previous text;
  changed_rows jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.check_unit_finishing(p_finishing);
  if coalesce(cardinality(p_unit_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'changed', 0);
  end if;
  complex := private.lock_units_block(p_block);
  ids := private.block_unit_ids(p_block, p_unit_ids);

  previous := private.mute_unit_rows();
  with prev as (
    select u.id, u.finishing_id as was, u.number as label
    from public.units u
    where u.block_id = p_block and u.id = any (ids) and u.finishing_id is distinct from p_finishing
  ),
  done as (
    update public.units u set finishing_id = p_finishing from prev where u.id = prev.id
    returning prev.was, prev.label
  )
  select coalesce(jsonb_agg(jsonb_build_object('finishing_id', d.was, 'number', d.label)), '[]')
    into changed_rows from done d;
  perform private.unmute_unit_rows(previous);

  perform private.write_units_summary(p_block, 'update',
    jsonb_build_object('finishing_id', jsonb_build_array(private.common_value(changed_rows, 'finishing_id'), p_finishing)),
    jsonb_build_object(
      'kind', 'finishing', 'count', jsonb_array_length(changed_rows),
      'numbers', private.unit_numbers_label(array(select x ->> 'number' from jsonb_array_elements(changed_rows) as x))));
  return jsonb_build_object('complex_id', complex, 'changed', jsonb_array_length(changed_rows));
end;
$$;

-- ─── Стояки готового блока (Н5) ──────────────────────────────────────────────────────────
-- Стояки отдельно не хранятся: сервер считает пары {id, layout_id} функцией riserChanges по
-- квартирам из block_unit_rows и присылает их сюда — layoutForSlot не дублируется в SQL.
-- layout_id null — снять планировку (ошибочную планировку иначе не убрать с 45 квартир разом);
-- ключ обязателен: без него «снять» случилось бы молча (riserChanges отдаёт layoutId).
create function public.set_units_layouts(p_block uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  complex uuid;
  wanted_ids uuid[];
  wanted_layouts uuid[];
  before text[];
  previous text;
  changed_rows jsonb;
  assigned jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Квартиры правит руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or exists (
    select 1 from jsonb_array_elements(p_items) as x
    where jsonb_typeof(x) is distinct from 'object' or nullif(x ->> 'id', '') is null
      or not x ? 'layout_id'
  ) then
    raise exception 'Нужен список квартир с планировками' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select array_agg((x ->> 'id')::uuid), array_agg(nullif(x ->> 'layout_id', '')::uuid)
    into wanted_ids, wanted_layouts
    from jsonb_array_elements(p_items) as x;
  if coalesce(cardinality(wanted_ids), 0) = 0 then
    return jsonb_build_object('complex_id', null, 'changed', 0);
  end if;
  if cardinality(wanted_ids) <> (select count(distinct x) from unnest(wanted_ids) as x) then
    raise exception 'Квартира в списке дважды' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  complex := private.lock_units_block(p_block);
  perform private.block_unit_ids(p_block, wanted_ids);
  if exists (
    select 1 from unnest(wanted_layouts) as w (layout_id)
    where w.layout_id is not null
      and not exists (select 1 from public.layouts l where l.id = w.layout_id and l.block_id = p_block)
  ) then
    raise exception 'Планировка не из этого блока' using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'layout_id';
  end if;

  before := private.complex_missing(complex);
  previous := private.mute_unit_rows();
  with prev as (
    select u.id, u.layout_id as was, w.layout_id as target, u.number as label
    from unnest(wanted_ids, wanted_layouts) as w (id, layout_id)
    join public.units u on u.id = w.id and u.block_id = p_block
    where u.layout_id is distinct from w.layout_id
  ),
  done as (
    update public.units u set layout_id = prev.target from prev where u.id = prev.id
    returning prev.was, prev.target, prev.label
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'was', private.layout_label(d.was), 'layout_id', d.target, 'label', private.layout_label(d.target),
      'number', d.label)), '[]')
    into changed_rows from done d;
  perform private.unmute_unit_rows(previous);

  -- Перепривязка меняет «осталось N», «цену от» и цену за м² на сайте.
  perform private.assert_complex_not_worse(complex, before);
  select coalesce(jsonb_agg(jsonb_build_object(
      'layout_id', g.layout_id, 'label', g.label, 'count', g.total, 'numbers', private.unit_numbers_label(g.labels)
    ) order by g.label nulls last), '[]')
    into assigned
  from (
    select x ->> 'layout_id' as layout_id, x ->> 'label' as label, array_agg(x ->> 'number') as labels, count(*) as total
    from jsonb_array_elements(changed_rows) as x
    group by x ->> 'layout_id', x ->> 'label'
  ) g;
  -- Пара — только при одной цели (и «сняли у всех» — тоже цель); разные — в summary.assigned.
  perform private.write_units_summary(p_block, 'update',
    case when jsonb_array_length(assigned) = 1 then jsonb_build_object('layout', jsonb_build_array(
      private.common_value(changed_rows, 'was'), assigned -> 0 -> 'label'))
    end,
    jsonb_build_object(
      'kind', 'layouts', 'count', jsonb_array_length(changed_rows),
      'numbers', private.unit_numbers_label(array(select x ->> 'number' from jsonb_array_elements(changed_rows) as x)),
      'assigned', assigned));
  return jsonb_build_object('complex_id', complex, 'changed', jsonb_array_length(changed_rows));
end;
$$;

-- ─── «Нет в наличии» у блока без списка квартир (Н7) ─────────────────────────────────────
-- Менеджер отмечает наличие (ТЗ 13.1–13.2) — только этот флаг, прямой правки планировок у него
-- нет. У блока со списком флаг не читается: наличие считается по квартирам. Проверки «не делает
-- хуже» нет — «нет в наличии», как и продажа, отражает реальность.
create function public.set_layout_available(p_layout uuid, p_available boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  layout_block uuid;
  complex uuid;
  changed integer;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Наличие меняют руководитель и менеджер' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_available is null then
    raise exception 'Нужно «доступна» или «нет в наличии»' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select l.block_id into layout_block from public.layouts l where l.id = p_layout;
  if layout_block is null then
    raise exception 'Планировка не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  complex := private.lock_units_block(layout_block);
  if not exists (select 1 from public.layouts l where l.id = p_layout and l.block_id = layout_block) then
    raise exception 'Планировка не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if exists (select 1 from public.units u where u.block_id = layout_block) then
    raise exception 'У блока есть список квартир — наличие считается по квартирам'
      using errcode = 'check_violation', hint = 'vh:list_exists';
  end if;
  update public.layouts l set available = p_available
    where l.id = p_layout and l.available is distinct from p_available;
  get diagnostics changed = row_count;
  return jsonb_build_object('complex_id', complex, 'changed', changed);
end;
$$;

comment on function public.add_unit(uuid, integer, integer, integer, text, uuid) is
  '«+ Квартира» (Н4): свободная квартира без цены в блок со списком; руководитель.';
comment on function public.update_unit(uuid, uuid, jsonb) is
  'Правка строки (Н4): только переданные поля — номер, планировка, цена, отделка; руководитель.';
comment on function public.delete_units(uuid, uuid[]) is
  'Удаление выделенных квартир (не всего списка); одна запись в журнале; руководитель.';
comment on function public.delete_block_units(uuid, text) is
  'Удаление списка квартир блока с подтверждением названием; наличие планировок — в ручной режим.';
comment on function public.set_units_status(uuid, uuid[], public.unit_status) is
  'Статус квартир блока (тап и массово): руководитель и менеджер; ответ undo для «Отменить».';
comment on function public.revert_units_status(uuid, public.unit_status, jsonb) is
  '«Отменить» смену статуса: возвращает прежние статусы, не трогая квартиры, которые уже поменяли.';
comment on function public.set_units_price(uuid, uuid[], text, numeric) is
  'Массовая цена (Н3): за квартиру, за м² или без цены; руководитель.';
comment on function public.set_units_finishing(uuid, uuid[], smallint) is
  'Массовая отделка; пусто — как в блоке; руководитель.';
comment on function public.set_units_layouts(uuid, jsonb) is
  'Стояки готового блока (Н5): планировки квартир парами {id, layout_id}; руководитель.';
comment on function public.set_layout_available(uuid, boolean) is
  '«Доступна / нет в наличии» у планировки блока без списка квартир (Н7): руководитель и менеджер.';

do $$
declare
  signature text;
begin
  foreach signature in array array[
    'public.block_unit_rows(uuid)',
    'public.create_block_units(uuid, jsonb)',
    'public.add_unit(uuid, integer, integer, integer, text, uuid)',
    'public.update_unit(uuid, uuid, jsonb)',
    'public.delete_units(uuid, uuid[])',
    'public.delete_block_units(uuid, text)',
    'public.set_units_status(uuid, uuid[], public.unit_status)',
    'public.revert_units_status(uuid, public.unit_status, jsonb)',
    'public.set_units_price(uuid, uuid[], text, numeric)',
    'public.set_units_finishing(uuid, uuid[], smallint)',
    'public.set_units_layouts(uuid, jsonb)',
    'public.set_layout_available(uuid, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon', signature);
    execute format('grant execute on function %s to authenticated', signature);
  end loop;
end;
$$;

-- ─── Журнал: подпись и контекст квартиры ─────────────────────────────────────────────────
-- Та же функция, что в шаге 11, плюс контекст квартиры: номер, блок и валюта блока переживают
-- удаление строки, смена планировки видна подписью «1-комн. · 42,5 м²». Флаг сводки
-- (vodiy.units_summary) проверяет условие WHEN у триггера units_audit, не эта функция.
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
  if tg_op = 'DELETE' and tg_table_name in ('layouts', 'units') and not exists (
    select 1 from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid
  ) then
    return null;
  end if;
  -- Файл чертежа виден в журнале через планировку («Чертёж · изменено», удаление планировки или
  -- блока); отдельные «Фото · добавлено / удалено» на каждый чертёж — шум и путают с галереей.
  if tg_table_name = 'media_assets' and row_data ->> 'kind' = 'drawing' then
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
    -- Подпись правки переживает удаление строки: журнал собирает «Блок A · 2-комн. · 64,5 м²»
    -- из записи. Скаляры — контекст, а не изменения (журнал показывает только пары [было, стало]).
    if tg_table_name = 'layouts' then
      changes := jsonb_build_object(
        'block_id', new_row -> 'block_id', 'rooms', new_row -> 'rooms', 'area', new_row -> 'area'
      ) || changes;
    elsif tg_table_name = 'blocks' then
      changes := jsonb_build_object('name', new_row -> 'name') || changes;
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
    end if;
  else
    changes := row_data - 'created_at' - 'updated_at';
    -- «+ Квартира» и удаление — с подписью планировки: голый id ничего не скажет после её удаления.
    if tg_table_name = 'units' and row_data ->> 'layout_id' is not null then
      changes := changes || jsonb_build_object('layout', private.layout_label((row_data ->> 'layout_id')::uuid));
    end if;
  end if;
  -- Название блока — тоже контекстом: подпись переживает и удаление самого блока; у квартиры
  -- ещё валюта — «350 000 000 → 360 000 000» без неё не прочитать.
  if tg_table_name in ('layouts', 'units') then
    select b.name, b.currency into block_name, block_currency
      from public.blocks b where b.id = nullif(row_data ->> 'block_id', '')::uuid;
    changes := changes || jsonb_build_object('block_name', block_name);
    if tg_table_name = 'units' then
      changes := changes || jsonb_build_object('currency', block_currency);
    end if;
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

-- Подпись квартиры: построчная запись и сводка с одной квартирой — «Блок A · кв. 41», сводка
-- с несколькими — «Блок A». Блок — живой, иначе из записи; старые записи без контекста — по
-- квартире, если она ещё есть.
create or replace function public.journal_entries(
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
             nullif(private.journal_layout_label(
               coalesce(
                 (select b.name from public.blocks b
                   where b.id::text = private.journal_value(a.changes, 'block_id')),
                 private.journal_value(a.changes, 'block_name')),
               private.journal_value(a.changes, 'rooms')::smallint,
               private.journal_value(a.changes, 'area')::numeric), ''))
           end,
           -- entity_id записи квартир — всегда uuid (квартира или блок у сводки): сравнение по uuid
           -- идёт по первичному ключу, а не перебором таблицы на каждую запись.
           case when a.entity = 'units' then private.journal_unit_label(
             coalesce(
               (select b.name from public.blocks b
                 where b.id = private.journal_value(a.changes, 'block_id')::uuid),
               case when not a.changes ? 'summary' then
                 (select b.name from public.units u join public.blocks b on b.id = u.block_id
                   where u.id = a.entity_id::uuid)
               end,
               private.journal_value(a.changes, 'block_name')),
             case
               when a.changes ? 'summary' then
                 case when (a.changes -> 'summary' ->> 'count')::integer = 1
                   then a.changes -> 'summary' ->> 'numbers'
                 end
               else coalesce(
                 (select u.number from public.units u where u.id = a.entity_id::uuid),
                 private.journal_value(a.changes, 'number'))
             end)
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

-- ─── «Планировки»: флаг «доступна» без ключа не трогаем (Н7) ─────────────────────────────
-- Флаг теперь меняют и на «Квартирах» (менеджер); вкладка «Планировки» перестаёт его слать
-- (12.2), и её устаревший черновик не затрёт «нет в наличии». Остальное — как в шаге 11.
create or replace function public.save_block_layouts(p_block uuid, p_layouts jsonb)
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
      update public.layouts l
        set rooms = (item ->> 'rooms')::smallint,
            area = (item ->> 'area')::numeric,
            drawing_id = drawing,
            price_from = (item ->> 'price_from')::numeric,
            available = coalesce((item ->> 'available')::boolean, l.available)
        where l.id = item_id and l.block_id = p_block;
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
