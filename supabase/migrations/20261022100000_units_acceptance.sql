-- Фаза 1 · шаг 12.7: доделки базы квартир по приёмке (22.10.2026).

-- ─── Журнал: валюта блока и у планировки ─────────────────────────────────────────────────
-- «Цена от» планировки — тоже деньги: «Удалить список блока» меняет её сам, и без валюты журнал
-- показал бы «350000000 → 399900000». Остальное — как в 12.1 (20261021120000_units_admin.sql).
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
