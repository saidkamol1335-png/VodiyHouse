-- Фаза 1 · схема 2б: блоки, планировки и квартиры (PLAN §3.1, §6, ТЗ 12).
-- Это простой список наличия, не шахматка: без клиентов, броней, продаж и истории сделок.

-- ─── Блоки ───────────────────────────────────────────────────────────────────────────────

create type public.build_status as enum ('building', 'delivered');
create type public.cadastre_status as enum ('done', 'in_progress', 'after_delivery');
create type public.currency as enum ('USD', 'UZS');

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid not null references public.complexes (id) on delete cascade,
  -- «A», «B», «1-я очередь».
  name text not null check (length(btrim(name)) between 1 and 40),
  build_status public.build_status not null default 'building',
  progress_pct smallint check (progress_pct between 0 and 100),
  floors_total smallint check (floors_total between 1 and 100),
  floors_built smallint check (floors_built >= 0),
  -- Срок сдачи — квартал и год (ТЗ 12).
  deadline_year smallint check (deadline_year between 2000 and 2100),
  deadline_quarter smallint check (deadline_quarter between 1 and 4),
  finishing_id smallint references public.finishings (id) on delete restrict,
  cadastre public.cadastre_status,
  cadastre_expected_on date,
  -- Что входит в цену: [{item: {ru, uz}, included, price?}] (ТЗ 12).
  price_includes jsonb not null default '[]' check (jsonb_typeof(price_includes) = 'array'),
  currency public.currency not null default 'USD',
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (complex_id, name),
  check (floors_built <= floors_total),
  check ((deadline_year is null) = (deadline_quarter is null))
);

create index blocks_complex_idx on public.blocks (complex_id, sort);

-- ─── Планировки ──────────────────────────────────────────────────────────────────────────

create table public.layouts (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks (id) on delete cascade,
  -- 0 — студия. «Тип квартиры» отдельно не хранится: считается по числу комнат (ТЗ 12).
  rooms smallint not null check (rooms between 0 and 10),
  area numeric(6, 2) not null check (area > 0 and area < 1000),
  drawing_id uuid references public.media_assets (id) on delete set null,
  -- Цена «от» вручную — для блока без списка квартир или квартир без цен (PLAN §3.1).
  price_from numeric(14, 2) check (price_from >= 0),
  -- Ручной флаг «доступна» — для блока без списка квартир (PLAN §3.1).
  available boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Цель составной ссылки из units: квартира — только на планировку своего блока.
  unique (id, block_id)
);

create index layouts_block_idx on public.layouts (block_id, rooms);
create index layouts_drawing_idx on public.layouts (drawing_id);

-- ─── Квартиры ────────────────────────────────────────────────────────────────────────────

create type public.unit_status as enum ('free', 'reserved', 'sold');

-- Комнаты и площадь берутся у планировки (стояк → планировка на диапазон этажей), а не
-- дублируются в квартире: одна правда для «осталось N» и расчёта.
create table public.units (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.blocks (id) on delete cascade,
  -- Пусто, пока стояку не назначена планировка: квартира есть в итоге блока, но не в типах.
  layout_id uuid,
  entrance smallint not null check (entrance between 1 and 50),
  floor smallint not null check (floor between -5 and 100),
  -- Позиция квартиры на этаже подъезда — номер стояка.
  position smallint not null check (position between 1 and 50),
  -- Номер можно править после генератора: «12», «12А».
  number text not null check (number ~ '^[0-9A-Za-zА-Яа-я/-]{1,10}$'),
  -- Цена целиком или за м²; нет обеих — у квартиры «цена по запросу», а «цена от» типа
  -- берётся у планировки.
  price numeric(14, 2) check (price >= 0),
  price_per_m2 numeric(12, 2) check (price_per_m2 >= 0),
  finishing_id smallint references public.finishings (id) on delete restrict,
  status public.unit_status not null default 'free',
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (block_id, entrance, floor, position),
  unique (block_id, number),
  check (num_nonnulls(price, price_per_m2) <= 1),
  -- Планировка чужого блока или ЖК исказила бы «осталось N»; удалили планировку — стояк пустеет.
  foreign key (layout_id, block_id) references public.layouts (id, block_id) on delete set null (layout_id)
);

create index units_block_status_idx on public.units (block_id, status);
create index units_layout_idx on public.units (layout_id);
create index units_finishing_idx on public.units (finishing_id);
create index units_updated_by_idx on public.units (updated_by);

-- Кто и когда последним менял квартиру — для списка в кабинете («обновлено 5 мин назад»).
create function private.stamp_unit_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  return new;
end;
$$;

-- Менеджер меняет только статус (PLAN §5, §7): прямой правки строк у него нет, только эта
-- функция. Возвращает число квартир, у которых статус действительно поменялся.
create function public.set_units_status(unit_ids uuid[], new_status public.unit_status)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Статус квартир меняют руководитель и менеджер' using errcode = 'insufficient_privilege';
  end if;
  update public.units set status = new_status where id = any (unit_ids) and status <> new_status;
  get diagnostics changed = row_count;
  return changed;
end;
$$;

comment on function public.set_units_status(uuid[], public.unit_status) is
  'Смена статуса квартир (одной или выделенных) менеджером или руководителем; пишется в журнал.';

-- ─── Журнал: к какому ЖК относится строка ────────────────────────────────────────────────

create or replace function private.audit_complex_id(entity text, row_data jsonb)
returns uuid
language sql
stable
set search_path = ''
as $$
  select case entity
    when 'complexes' then (row_data ->> 'id')::uuid
    when 'layouts' then (select b.complex_id from public.blocks b where b.id = (row_data ->> 'block_id')::uuid)
    when 'units' then (select b.complex_id from public.blocks b where b.id = (row_data ->> 'block_id')::uuid)
    else nullif(row_data ->> 'complex_id', '')::uuid
  end
$$;

-- ─── Триггеры ────────────────────────────────────────────────────────────────────────────

create trigger blocks_set_updated_at before update on public.blocks
  for each row execute function public.set_updated_at();
create trigger layouts_set_updated_at before update on public.layouts
  for each row execute function public.set_updated_at();
create trigger units_stamp_change before insert or update on public.units
  for each row execute function private.stamp_unit_change();

create trigger blocks_audit after insert or update or delete on public.blocks
  for each row execute function private.write_audit();
create trigger layouts_audit after insert or update or delete on public.layouts
  for each row execute function private.write_audit();
create trigger units_audit after insert or update or delete on public.units
  for each row execute function private.write_audit();

revoke all on function private.stamp_unit_change() from public;
revoke all on function public.set_units_status(uuid[], public.unit_status) from public, anon;
grant execute on function public.set_units_status(uuid[], public.unit_status) to authenticated;

-- ─── Права (PLAN §5) ─────────────────────────────────────────────────────────────────────

alter table public.blocks enable row level security;
alter table public.layouts enable row level security;
alter table public.units enable row level security;

revoke all on public.blocks, public.layouts, public.units from anon, authenticated;
grant select on public.blocks, public.layouts to anon, authenticated;
-- Квартиры посетитель напрямую не читает: только агрегаты и статус через функции (шаг 4).
grant select, insert, update, delete on public.blocks, public.layouts, public.units to authenticated;

create policy "blocks: сайт — у опубликованных ЖК, сотрудники — все"
  on public.blocks for select to anon, authenticated
  using (private.is_public_complex(complex_id) or (select private.is_staff()));

create policy "layouts: сайт — у опубликованных ЖК, сотрудники — все"
  on public.layouts for select to anon, authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.blocks b where b.id = block_id and private.is_public_complex(b.complex_id)
    )
  );

create policy "units: читают сотрудники"
  on public.units for select to authenticated
  using ((select private.is_staff()));

do $$
declare
  content_table text;
begin
  foreach content_table in array array['blocks', 'layouts', 'units'] loop
    execute format(
      'create policy "%s: добавляет руководитель" on public.%I for insert to authenticated
         with check ((select private.has_role(''head'')))', content_table, content_table);
    execute format(
      'create policy "%s: правит руководитель" on public.%I for update to authenticated
         using ((select private.has_role(''head''))) with check ((select private.has_role(''head'')))',
      content_table, content_table);
    execute format(
      'create policy "%s: удаляет руководитель" on public.%I for delete to authenticated
         using ((select private.has_role(''head'')))', content_table, content_table);
  end loop;
end;
$$;
