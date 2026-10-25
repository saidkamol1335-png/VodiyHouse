-- Журнал (шаг 3.5): у записей документов, деталей, видео и переносов сроков ЖК — понятный
-- заголовок («Разрешение на строительство», «Благоустройство», «Блок B»), как у блоков и
-- планировок; во всём журнале — с названием ЖК. Остальное — как в 20261021150000.

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
               a.changes -> 'title' ->> 'ru',
               private.journal_value(a.changes, 'youtube_id'))
             end,
             case when a.entity = 'deadline_changes' then private.journal_block_label(coalesce(
               (select b.name from public.deadline_changes c join public.blocks b on b.id = c.block_id
                 where c.id::text = a.entity_id),
               (select b.name from public.blocks b where b.id::text = private.journal_value(a.changes, 'block_id'))))
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
