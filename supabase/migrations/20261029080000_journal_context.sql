-- Фаза 3, «Полировка» (блок C, журнал): подпись записи переживает удаление строки.
-- 1) Правка документа, темы деталей, видео и переноса срока несёт контекстом тип документа, тему,
--    код и подпись ролика, блок и его название (как планировка и квартира): после удаления строки
--    журнал подписывал прошлую правку названием ЖК.
-- 2) Удаление блока каскадом убирает его переносы сроков — отдельные «Перенос срока · удалено»
--    (подписанные ЖК: блока уже нет) не пишутся, удаление видно записью самого блока. Комментарий
--    у таблицы в 20261025180000_complex_page.sql об этом — устарел.
-- 3) journal_entries: перенос — названием блока из записи, если блока уже нет; подпись видео,
--    изменённая той же правкой, — новая.

-- Тело — как в 20261029030000_phase4_polish.sql, кроме правок «Полировки 3» (помечены).
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
  if tg_op = 'DELETE' and tg_table_name in ('layouts', 'units', 'deadline_changes') and not exists (
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

-- Тело — как в 20261028150000_showcase.sql, кроме правок «Полировки 3» (помечены).
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
         -- Во всём журнале («Настройки → Журнал») блок, планировка и квартира — с названием ЖК:
         -- «Блок A · кв. 41» без него не понять, о каком доме речь. Во вкладке ЖК — без него.
         case
           when p_complex is null and a.entity in (
             'blocks', 'layouts', 'units', 'complex_documents', 'complex_details', 'complex_videos', 'deadline_changes'
           )
             then nullif(concat_ws(' · ', cx.name ->> 'ru', named.subject), '')
           else named.subject
         end
  from public.audit_log a
  left join public.profiles p on p.id = a.actor_id
  left join public.complexes cx on cx.id = a.complex_id
  cross join lateral (
    select
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
             -- Шаг 3.5: документ и тема — названием из справочника (у правки в changes только
             -- изменённое — тип берём из строки, у удалённой — из записи), видео — подписью или id,
             -- перенос срока — блоком.
             case when a.entity = 'complex_documents' then (
               select t.name ->> 'ru' from public.document_types t
               where t.id = coalesce(
                 (select d.document_type_id from public.complex_documents d where d.id::text = a.entity_id),
                 private.journal_value(a.changes, 'document_type_id')::smallint)
             ) end,
             case when a.entity = 'complex_details' then (
               select t.name ->> 'ru' from public.detail_topics t
               where t.id = coalesce(
                 (select d.topic_id from public.complex_details d where d.id::text = a.entity_id),
                 private.journal_value(a.changes, 'topic_id')::smallint)
             ) end,
             case when a.entity = 'complex_videos' then coalesce(
               (select coalesce(v.title ->> 'ru', v.youtube_id) from public.complex_videos v where v.id::text = a.entity_id),
               -- Полировка 3: подпись, изменённая этой же правкой, — пара [старая, новая] (помечено).
               case jsonb_typeof(a.changes -> 'title')
                 when 'object' then a.changes -> 'title' ->> 'ru'
                 when 'array' then a.changes -> 'title' -> 1 ->> 'ru'
               end,
               private.journal_value(a.changes, 'youtube_id'))
             end,
             case when a.entity = 'deadline_changes' then private.journal_block_label(coalesce(
               (select b.name from public.deadline_changes c join public.blocks b on b.id = c.block_id
                 where c.id::text = a.entity_id),
               (select b.name from public.blocks b where b.id::text = private.journal_value(a.changes, 'block_id')),
               -- Полировка 3: блока уже нет — название из записи (помечено).
               private.journal_value(a.changes, 'block_name')))
             end,
             -- Витрина (3.16а): спецпредложение, подборка и реклама — заголовком; у удалённой
             -- записи — из самой записи (при правке changes.title — пара [старое, новое]).
             case when a.entity in ('specials', 'collections', 'ads') then coalesce(
               (select s.title ->> 'ru' from public.specials s where a.entity = 'specials' and s.id::text = a.entity_id),
               (select c.title ->> 'ru' from public.collections c where a.entity = 'collections' and c.id::text = a.entity_id),
               (select x.title ->> 'ru' from public.ads x where a.entity = 'ads' and x.id::text = a.entity_id),
               case jsonb_typeof(a.changes -> 'title')
                 when 'object' then a.changes -> 'title' ->> 'ru'
                 when 'array' then a.changes -> 'title' -> 1 ->> 'ru'
               end)
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
           ) as subject
  ) named
  where (p_developer is null or a.developer_id = p_developer)
    and (p_complex is null or a.complex_id = p_complex)
    and (p_before is null or a.id < p_before)
  order by a.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200)
$$;
