-- Фаза 4, «Полировка» (второй агент 4.1 и хвосты 3, B):
-- 1) Дата переноса срока по умолчанию — ташкентская (current_date — дата базы в UTC: запись с 00:00
--    до 05:00 по Ташкенту получала вчерашний день). Дата проверки документа уже по Ташкенту
--    (20261025220000_block_c_review.sql).
-- 2) Этажность блока нельзя опустить ниже его планов этажей: иначе любое сохранение плана (даже
--    контуров) упиралось бы в «Этажей в блоке — N».
-- 3) Журнал: картинка плана этажа — не отдельная запись (как чертёж), а у правки контуров квартир
--    в журнале — их число «было → стало», а не два полных массива точек.

alter table public.deadline_changes
  alter column changed_on set default private.tashkent_today();

create function private.guard_block_floors_plans()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.floors_total is not null and exists (
    select 1 from public.floor_plans p where p.block_id = new.id and p.floor_to > new.floors_total
  ) then
    raise exception 'Выше % этажа есть планы этажей — сначала поправьте их на вкладке «Фасад и планы»',
      new.floors_total
      using errcode = 'check_violation', hint = 'vh:floors_below_plans';
  end if;
  return new;
end;
$$;

-- Только когда этажность правда меняется: «Блоки» сохраняют её у каждого блока при любой правке.
create trigger blocks_floors_above_plans before update of floors_total on public.blocks
  for each row when (new.floors_total is distinct from old.floors_total)
  execute function private.guard_block_floors_plans();

revoke all on function private.guard_block_floors_plans() from public, anon;

-- Тело — как в 20261022100000_units_acceptance.sql, кроме двух правок фазы 4 (помечены).
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
