-- «Полировка» блока C: «Сохранить» на вкладке «Планировки» без изменений больше не двигает «Наличие
-- обновлено» на странице ЖК — save_block_layouts обновляет строку планировки, только если в ней
-- что-то поменялось (иначе срабатывал set_updated_at). Остальное — как в 20261021150000.

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
      if not exists (select 1 from public.layouts l where l.id = item_id and l.block_id = p_block) then
        raise exception 'Планировка не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
      end if;
      -- Без изменений — строку не трогаем: updated_at двигает «Наличие обновлено» на сайте.
      update public.layouts l
        set rooms = (item ->> 'rooms')::smallint,
            area = (item ->> 'area')::numeric,
            drawing_id = drawing,
            price_from = case when item ? 'price_from' then (item ->> 'price_from')::numeric else l.price_from end,
            available = coalesce((item ->> 'available')::boolean, l.available)
        where l.id = item_id and l.block_id = p_block
          and (l.rooms, l.area, l.drawing_id, l.price_from, l.available) is distinct from (
            (item ->> 'rooms')::smallint,
            (item ->> 'area')::numeric,
            drawing,
            case when item ? 'price_from' then (item ->> 'price_from')::numeric else l.price_from end,
            coalesce((item ->> 'available')::boolean, l.available)
          );
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
