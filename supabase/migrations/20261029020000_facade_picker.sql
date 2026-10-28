-- Фаза 4 (4.1): «Выбрать квартиру» на фасаде (PLAN §6, §7; мокап SiteJkPick, MobJkFacade, MobJkFloor).
-- Фасад ЖК — media_assets вида 'facade' (один на ЖК, индекс с фазы 1). Контур блока на фасаде —
-- blocks.facade_contour. План этажа — floor_plans: блок, подъезд (null — весь этаж), диапазон этажей,
-- картинка вида 'floor_plan' и контуры квартир по месту на этаже (подъезд + позиция стояка: та же
-- пара, что у units). Координаты — проценты картинки, 0–100, как viewBox="0 0 100 100" у сайта.
-- Пишет руководитель: фасад и контур блока — по политикам media_assets и blocks, планы этажей —
-- только RPC (как квартиры); читают сотрудники и посетитель опубликованного ЖК. Сайт берёт всё одним RPC site_complex_picker, квартиры — block_units (фаза 1).

-- ─── Проверки формы ──────────────────────────────────────────────────────────────────────

-- Контур: 3–40 точек [x, y], каждая в процентах 0–100.
create function private.is_contour(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  pt jsonb;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) not between 3 and 40 then
    return false;
  end if;
  for pt in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
       or jsonb_typeof(pt -> 0) <> 'number' or jsonb_typeof(pt -> 1) <> 'number' then
      return false;
    end if;
    if (pt ->> 0)::numeric not between 0 and 100 or (pt ->> 1)::numeric not between 0 and 100 then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

-- Контуры квартир плана: до 200 штук {entrance, position, points}, место на этаже — один раз.
create function private.is_unit_contours(p jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  seen text[] := '{}';
  slot text;
begin
  if p is null or jsonb_typeof(p) <> 'array' or jsonb_array_length(p) > 200 then
    return false;
  end if;
  for item in select value from jsonb_array_elements(p) loop
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'entrance') <> 'number' or jsonb_typeof(item -> 'position') <> 'number'
       or not private.is_contour(item -> 'points') then
      return false;
    end if;
    if (item ->> 'entrance')::numeric not between 1 and 50 or (item ->> 'entrance')::numeric <> trunc((item ->> 'entrance')::numeric)
       or (item ->> 'position')::numeric not between 1 and 50 or (item ->> 'position')::numeric <> trunc((item ->> 'position')::numeric) then
      return false;
    end if;
    slot := (item ->> 'entrance')::numeric::int || ':' || (item ->> 'position')::numeric::int;
    if slot = any (seen) then
      return false;
    end if;
    seen := seen || slot;
  end loop;
  return true;
end;
$$;

-- ─── Контур блока на фасаде ──────────────────────────────────────────────────────────────

alter table public.blocks
  add column facade_contour jsonb check (facade_contour is null or private.is_contour(facade_contour));

-- ─── Планы этажей ────────────────────────────────────────────────────────────────────────

create table public.floor_plans (
  id uuid primary key default gen_random_uuid(),
  -- ЖК — из блока (триггер ниже): журнал и уборка ЖК находят план без соединения.
  complex_id uuid not null references public.complexes (id) on delete cascade,
  block_id uuid not null references public.blocks (id) on delete cascade,
  -- null — один план на весь этаж (все подъезды).
  entrance smallint check (entrance between 1 and 50),
  floor_from smallint not null check (floor_from between 1 and 100),
  floor_to smallint not null check (floor_to between 1 and 100),
  image_id uuid not null unique references public.media_assets (id) on delete cascade,
  contours jsonb not null default '[]' check (private.is_unit_contours(contours)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (floor_to >= floor_from)
);

create index floor_plans_block_idx on public.floor_plans (block_id, floor_from);
create index floor_plans_complex_idx on public.floor_plans (complex_id);

-- ЖК из блока, картинка — план этажа этого ЖК, этажи — в пределах блока, и два плана одного
-- блока не делят этаж одного подъезда (план «весь этаж» пересекается с любым подъездом).
create function private.prepare_floor_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  block_floors smallint;
begin
  select b.complex_id, b.floors_total into new.complex_id, block_floors
  from public.blocks b where b.id = new.block_id;
  if new.complex_id is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if block_floors is not null and new.floor_to > block_floors then
    raise exception 'Этажей в блоке — %', block_floors using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  if not exists (
    select 1 from public.media_assets m
    where m.id = new.image_id and m.kind = 'floor_plan' and m.complex_id = new.complex_id
  ) then
    raise exception 'Картинка плана — не из этого ЖК' using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  if exists (
    select 1 from public.floor_plans p
    where p.block_id = new.block_id and p.id <> new.id
      and p.floor_from <= new.floor_to and new.floor_from <= p.floor_to
      and (p.entrance is null or new.entrance is null or p.entrance = new.entrance)
  ) then
    raise exception 'Эти этажи уже есть в другом плане блока'
      using errcode = 'unique_violation', hint = 'vh:duplicate';
  end if;
  return new;
end;
$$;

-- План ушёл каскадом (удалён блок) — его картинка не нужна никому: строка уходит следом. Файл
-- удаляет действие «Блоки»: пути картинок планов удаляемых блоков оно собирает до сохранения.
create function private.drop_floor_plan_image()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  delete from public.media_assets where id = old.image_id;
  return old;
end;
$$;

create trigger floor_plans_prepare before insert or update on public.floor_plans
  for each row execute function private.prepare_floor_plan();
create trigger floor_plans_drop_image after delete on public.floor_plans
  for each row execute function private.drop_floor_plan_image();
create trigger floor_plans_set_updated_at before update on public.floor_plans
  for each row execute function public.set_updated_at();
create trigger floor_plans_audit after insert or update or delete on public.floor_plans
  for each row execute function private.write_audit();

alter table public.floor_plans enable row level security;

create policy "floor_plans: читают посетители опубликованного ЖК и сотрудники"
  on public.floor_plans for select to anon, authenticated
  using (private.is_public_complex(complex_id) or (select private.is_staff()));
-- Пишут только RPC руководителя (security definer, как у квартир): прямая запись обошла бы правило
-- 1.2, блокировку ЖК и проверку подъезда у контуров.
revoke all on public.floor_plans from anon, authenticated;
grant select on public.floor_plans to anon, authenticated;

-- ─── Кабинет: фасад ──────────────────────────────────────────────────────────────────────

-- Фасад ЖК: заменяет прежний одной транзакцией. Контуры блоков рисовались по старой картинке —
-- с новой они не совпадут, поэтому снимаются (кабинет предупреждает). У опубликованного ЖК —
-- с отметкой правила 1.2, как фото. Возвращает ЖК и путь старого файла (его удаляет сервер).
create function public.set_complex_facade(
  p_complex uuid,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_rule12 boolean default false
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Фасад загружает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.require_rule12(private.locked_complex_status(p_complex), p_rule12);
  delete from public.media_assets
  where complex_id = p_complex and kind = 'facade'
  returning path into old_path;
  insert into public.media_assets (complex_id, kind, path, width, height, blur)
  values (p_complex, 'facade', p_path, p_width, p_height, p_blur);
  update public.blocks set facade_contour = null
  where complex_id = p_complex and facade_contour is not null;
  return jsonb_build_object('complex_id', p_complex, 'old_path', old_path);
end;
$$;

-- Убрать фасад: раздел «Выбрать квартиру» скрывается, контуры блоков снимаются.
create function public.remove_complex_facade(p_complex uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Фасад убирает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.locked_complex_status(p_complex);
  delete from public.media_assets
  where complex_id = p_complex and kind = 'facade'
  returning path into old_path;
  update public.blocks set facade_contour = null
  where complex_id = p_complex and facade_contour is not null;
  return jsonb_build_object('complex_id', p_complex, 'old_path', old_path);
end;
$$;

-- Контур блока на фасаде (null — снять). Без фасада контуру не на чем лежать.
create function public.set_block_contour(p_block uuid, p_contour jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  block_complex uuid;
begin
  if not private.has_role('head') then
    raise exception 'Контуры рисует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select b.complex_id into block_complex from public.blocks b where b.id = p_block;
  if block_complex is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.locked_complex_status(block_complex);
  if p_contour is not null and not exists (
    select 1 from public.media_assets m where m.complex_id = block_complex and m.kind = 'facade'
  ) then
    raise exception 'Сначала загрузите фасад' using errcode = 'check_violation', hint = 'vh:not_ready';
  end if;
  update public.blocks set facade_contour = p_contour where id = p_block;
  return jsonb_build_object('complex_id', block_complex);
end;
$$;

-- ─── Кабинет: планы этажей ───────────────────────────────────────────────────────────────

-- Новый план (p_plan null) — с картинкой; правка — подъезд и этажи, а с новой картинкой ещё и
-- сброс контуров (они рисовались по старой). Картинка у опубликованного ЖК — с отметкой 1.2.
-- Возвращает план, ЖК и путь старой картинки.
create function public.save_floor_plan(
  p_plan uuid,
  p_block uuid,
  p_entrance smallint,
  p_floor_from smallint,
  p_floor_to smallint,
  p_path text default null,
  p_width integer default null,
  p_height integer default null,
  p_blur text default null,
  p_rule12 boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  block_complex uuid;
  plan_id uuid := p_plan;
  new_image uuid;
  old_image uuid;
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Планы этажей загружает руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select b.complex_id into block_complex from public.blocks b where b.id = p_block;
  if block_complex is null then
    raise exception 'Блок не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if p_path is not null then
    perform private.require_rule12(private.locked_complex_status(block_complex), p_rule12);
    insert into public.media_assets (complex_id, kind, path, width, height, blur)
    values (block_complex, 'floor_plan', p_path, p_width, p_height, p_blur)
    returning id into new_image;
  else
    perform private.locked_complex_status(block_complex);
  end if;
  if plan_id is null then
    if new_image is null then
      raise exception 'Нужна картинка плана' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
    end if;
    insert into public.floor_plans (complex_id, block_id, entrance, floor_from, floor_to, image_id)
    values (block_complex, p_block, p_entrance, p_floor_from, p_floor_to, new_image)
    returning id into plan_id;
  else
    select p.image_id into old_image from public.floor_plans p where p.id = plan_id and p.block_id = p_block;
    if old_image is null then
      raise exception 'План не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    update public.floor_plans set
      entrance = p_entrance,
      floor_from = p_floor_from,
      floor_to = p_floor_to,
      image_id = coalesce(new_image, image_id),
      -- Новая картинка — контуры заново; план стал планом подъезда — только его контуры.
      contours = case
        when new_image is not null then '[]'::jsonb
        when p_entrance is null then contours
        else (select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(contours) c
              where (c ->> 'entrance')::int = p_entrance)
      end
    where id = plan_id;
    if new_image is not null then
      delete from public.media_assets where id = old_image returning path into old_path;
    end if;
  end if;
  return jsonb_build_object('id', plan_id, 'complex_id', block_complex, 'old_path', old_path);
end;
$$;

-- Контуры квартир плана целиком. У плана подъезда — только его подъезд.
create function public.set_floor_plan_contours(p_plan uuid, p_contours jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.floor_plans;
begin
  if not private.has_role('head') then
    raise exception 'Контуры рисует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into plan from public.floor_plans where id = p_plan;
  if plan.id is null then
    raise exception 'План не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.locked_complex_status(plan.complex_id);
  if not private.is_unit_contours(p_contours) then
    raise exception 'Контуры квартир — неверный формат' using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  if plan.entrance is not null and exists (
    select 1 from jsonb_array_elements(p_contours) c where (c ->> 'entrance')::smallint <> plan.entrance
  ) then
    raise exception 'Контур — другого подъезда' using errcode = 'check_violation', hint = 'vh:invalid';
  end if;
  update public.floor_plans set contours = p_contours where id = p_plan;
  return jsonb_build_object('complex_id', plan.complex_id);
end;
$$;

-- Удалить план с картинкой; путь файла — серверу.
create function public.delete_floor_plan(p_plan uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan public.floor_plans;
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Планы этажей удаляет руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  select * into plan from public.floor_plans where id = p_plan;
  if plan.id is null then
    raise exception 'План не найден — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  perform private.locked_complex_status(plan.complex_id);
  -- План уходит каскадом вместе со своей картинкой.
  delete from public.media_assets where id = plan.image_id returning path into old_path;
  return jsonb_build_object('complex_id', plan.complex_id, 'old_path', old_path);
end;
$$;

-- ─── Сайт ────────────────────────────────────────────────────────────────────────────────

-- «Выбрать квартиру»: фасад, контуры блоков и планы этажей ЖК. null — ЖК не виден; без фасада
-- facade = null (раздел сайта скрыт). Квартиры и статусы — block_units по выбранному блоку.
create function public.site_complex_picker(p_complex uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.can_see_complex(p_complex) then jsonb_build_object(
    'complex_id', p_complex,
    'facade', (
      select private.site_media(m) from public.media_assets m
      where m.complex_id = p_complex and m.kind = 'facade'),
    'blocks', (
      select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'contour', b.facade_contour)
        order by b.sort, b.name), '[]'::jsonb)
      from public.blocks b
      where b.complex_id = p_complex and b.facade_contour is not null),
    'plans', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'block_id', p.block_id, 'entrance', p.entrance,
        'floor_from', p.floor_from, 'floor_to', p.floor_to,
        'image', private.site_media(m), 'contours', p.contours)
        order by p.block_id, p.floor_from, p.entrance nulls first), '[]'::jsonb)
      from public.floor_plans p
      join public.media_assets m on m.id = p.image_id
      where p.complex_id = p_complex)
  ) end
$$;

comment on function public.set_complex_facade(uuid, text, integer, integer, text, boolean) is
  'Фасад ЖК (фаза 4): заменяет прежний, снимает контуры блоков; возвращает ЖК и путь старого файла.';
comment on function public.remove_complex_facade(uuid) is
  'Убирает фасад ЖК и контуры блоков; возвращает ЖК и путь файла.';
comment on function public.set_block_contour(uuid, jsonb) is
  'Контур блока на фасаде в процентах картинки (null — снять).';
comment on function public.save_floor_plan(uuid, uuid, smallint, smallint, smallint, text, integer, integer, text, boolean) is
  'План этажа блока: новый (с картинкой) или правка подъезда, этажей и картинки (новая сбрасывает контуры).';
comment on function public.set_floor_plan_contours(uuid, jsonb) is
  'Контуры квартир плана этажа целиком: [{entrance, position, points}].';
comment on function public.delete_floor_plan(uuid) is
  'Удаляет план этажа с картинкой; возвращает ЖК и путь файла.';
comment on function public.site_complex_picker(uuid) is
  'Сайт, «Выбрать квартиру»: фасад, контуры блоков и планы этажей видимого ЖК.';

revoke all on function
  private.is_contour(jsonb),
  private.is_unit_contours(jsonb),
  private.prepare_floor_plan(),
  private.drop_floor_plan_image(),
  public.set_complex_facade(uuid, text, integer, integer, text, boolean),
  public.remove_complex_facade(uuid),
  public.set_block_contour(uuid, jsonb),
  public.save_floor_plan(uuid, uuid, smallint, smallint, smallint, text, integer, integer, text, boolean),
  public.set_floor_plan_contours(uuid, jsonb),
  public.delete_floor_plan(uuid),
  public.site_complex_picker(uuid)
from public, anon;
grant execute on function
  private.is_contour(jsonb),
  private.is_unit_contours(jsonb)
to anon, authenticated, service_role;
grant execute on function
  public.set_complex_facade(uuid, text, integer, integer, text, boolean),
  public.remove_complex_facade(uuid),
  public.set_block_contour(uuid, jsonb),
  public.save_floor_plan(uuid, uuid, smallint, smallint, smallint, text, integer, integer, text, boolean),
  public.set_floor_plan_contours(uuid, jsonb),
  public.delete_floor_plan(uuid)
to authenticated;
grant execute on function public.site_complex_picker(uuid) to anon, authenticated;
