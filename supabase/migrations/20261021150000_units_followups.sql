-- Фаза 1 · шаг 12.2: доделки базы квартир по ревью (21.10.2026).

-- ─── «Планировки»: «цена от» без ключа не трогаем ─────────────────────────────────────────
-- Как и «доступна» (12.1): вкладка шлёт поле, только если его правили. Иначе устаревший черновик
-- затёр бы «цену от», которую поставило «Удалить список блока», а у блока со списком она и не
-- видна в форме. Остальное — как в 12.1.
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
            price_from = case when item ? 'price_from' then (item ->> 'price_from')::numeric else l.price_from end,
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

-- ─── Журнал: название ЖК у блока, планировки и квартиры во всём журнале ──────────────────
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
           when p_complex is null and a.entity in ('blocks', 'layouts', 'units')
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
