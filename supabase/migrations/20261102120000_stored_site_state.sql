-- Проект-2, фаза B (PLAN §10, п. 11): состояние ЖК и полнота планировки хранятся и пересчитываются
-- при каждом сохранении связанных данных, а не при каждом чтении сайта и кабинета.
--   complexes.missing_count — сколько пунктов минимума ЖК не выполнено («Для публикации: N из 6»);
--   complexes.site_state    — draft (минимума нет) · soon (минимум есть, полных квартир нет) · full;
--   layouts.is_complete     — полная планировка (docs/publication-rule.md, «Полная квартира»).
-- status остаётся отметкой руководителя (опубликован / скрыт / архив): сайт показывает ЖК, только
-- если status = 'published', застройщик опубликован и site_state <> 'draft'. Определения те же, что
-- в 20261101120000 (private.complex_requirements, private.layout_completeness): здесь только их
-- результат запоминается. Сверка «хранимое = посчитанное» — tests/db/site-state.test.ts.

alter table public.complexes
  add column missing_count smallint not null default 6 check (missing_count between 0 and 6),
  add column site_state text not null default 'draft' check (site_state in ('draft', 'soon', 'full'));

alter table public.layouts
  add column is_complete boolean not null default false;

create index layouts_complete_idx on public.layouts (block_id) where is_complete;

-- Пересчёт состояния — не правка: «обновлено …» на сайте (updated_at квартир, планировок, ЖК)
-- не должно меняться от смены курса или статуса застройщика. Тело — как в 20261018221850.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(current_setting('vodiy.state_refresh', true), '') = 'on' then
    return new;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Посчитать сейчас ────────────────────────────────────────────────────────────────────
create function private.complex_state_now(p_complex uuid)
returns table (missing_count smallint, site_state text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    m.n,
    case
      when m.n > 0 then 'draft'
      when exists (
        select 1 from private.layout_completeness c where c.complex_id = p_complex and c.is_complete
      ) then 'full'
      else 'soon'
    end
  from (select cardinality(private.complex_missing(p_complex))::smallint as n) m
$$;

revoke all on function private.complex_state_now(uuid) from public, anon, authenticated;

-- ─── Запомнить ───────────────────────────────────────────────────────────────────────────
-- Пишет только изменившееся. Своё обновление не пишет в журнал (это не правка человека) и не
-- запускает пересчёт повторно: флаг vodiy.state_refresh держится до конца вызова.
create function private.refresh_complex_states(p_complexes uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  was_refreshing text := coalesce(current_setting('vodiy.state_refresh', true), '');
  was_skipping text := coalesce(current_setting('vodiy.skip_audit', true), '');
  worse uuid;
begin
  if was_refreshing = 'on' or cardinality(p_complexes) = 0 then
    return;
  end if;
  perform set_config('vodiy.state_refresh', 'on', true);
  perform set_config('vodiy.skip_audit', 'on', true);

  update public.layouts l
    set is_complete = c.is_complete
    from private.layout_completeness c
    where c.complex_id = any (p_complexes)
      and l.id = c.layout_id
      and l.is_complete is distinct from c.is_complete;

  create temporary table if not exists pg_temp.vh_complex_states (
    id uuid primary key, missing_count smallint, site_state text
  ) on commit drop;
  delete from pg_temp.vh_complex_states;
  insert into pg_temp.vh_complex_states
    select ids.id, now_state.missing_count, now_state.site_state
    from (select distinct unnest(p_complexes) as id) ids
    cross join lateral private.complex_state_now(ids.id) now_state;

  -- Правило публикации v2: обязательный пункт опубликованного ЖК не убрать — сначала «Скрыть».
  -- Функции кабинета проверяют это сами (assert_complex_not_worse); здесь — на любом пути, в том
  -- числе прямой записью в таблицы под сессией сотрудника. Без сессии (сид DEMO, миграции,
  -- расписание) — не мешаем.
  select x.id into worse
    from public.complexes x join pg_temp.vh_complex_states s on s.id = x.id
    where x.status = 'published' and s.missing_count > x.missing_count
    limit 1;
  if worse is not null and auth.uid() is not null then
    raise exception 'Обязательный пункт опубликованного ЖК нельзя убрать — сначала нажмите «Скрыть»'
      using errcode = 'check_violation', hint = 'vh:not_ready',
            detail = array_to_string(private.complex_missing(worse), ',');
  end if;

  update public.complexes x
    set missing_count = s.missing_count, site_state = s.site_state
    from pg_temp.vh_complex_states s
    where x.id = s.id
      and (x.missing_count, x.site_state) is distinct from (s.missing_count, s.site_state);

  perform set_config('vodiy.skip_audit', was_skipping, true);
  perform set_config('vodiy.state_refresh', was_refreshing, true);
end;
$$;

revoke all on function private.refresh_complex_states(uuid[]) from public, anon, authenticated;

-- ─── Когда пересчитывать ─────────────────────────────────────────────────────────────────
-- Триггеры на оператор с переходными таблицами (docs Postgres, «Auditing with Transition Tables»):
-- массовая правка 100 квартир — один пересчёт ЖК, а не сто. Переходные таблицы нельзя сочетать
-- со списком столбцов UPDATE OF, поэтому лишние вызовы отсекает refresh_complex_states (пишет
-- только изменившееся) и флаг повторного входа.
create function private.refresh_states_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ids uuid[] := '{}';
begin
  if coalesce(current_setting('vodiy.state_refresh', true), '') = 'on' then
    return null;
  end if;

  -- Каждый запрос к new_rows / old_rows — отдельным оператором внутри проверки tg_op: условие if
  -- вычисляется одним SQL, и у INSERT нет old_rows, у DELETE — new_rows.
  if tg_table_name = 'settings' then
    if tg_op <> 'DELETE' then
      if exists (select 1 from new_rows r where r.key = 'exchange.usd_uzs') then
        ids := array(select c.id from public.complexes c);
      end if;
    end if;
    if tg_op <> 'INSERT' and cardinality(ids) = 0 then
      if exists (select 1 from old_rows r where r.key = 'exchange.usd_uzs') then
        ids := array(select c.id from public.complexes c);
      end if;
    end if;
  elsif tg_table_name = 'complexes' then
    if tg_op <> 'DELETE' then
      ids := array(select r.id from new_rows r);
    end if;
  elsif tg_table_name in ('media_assets', 'blocks') then
    if tg_op <> 'DELETE' then
      ids := ids || array(select r.complex_id from new_rows r);
    end if;
    if tg_op <> 'INSERT' then
      ids := ids || array(select r.complex_id from old_rows r);
    end if;
  elsif tg_table_name in ('layouts', 'units') then
    if tg_op <> 'DELETE' then
      ids := ids || array(select b.complex_id from new_rows r join public.blocks b on b.id = r.block_id);
    end if;
    if tg_op <> 'INSERT' then
      ids := ids || array(select b.complex_id from old_rows r join public.blocks b on b.id = r.block_id);
    end if;
  elsif tg_table_name = 'payment_programs' then
    if tg_op <> 'DELETE' then
      ids := ids || array(select c.id from new_rows r join public.complexes c on c.developer_id = r.developer_id);
    end if;
    if tg_op <> 'INSERT' then
      ids := ids || array(select c.id from old_rows r join public.complexes c on c.developer_id = r.developer_id);
    end if;
  elsif tg_table_name = 'developers' then
    -- Удаление застройщика каскадом удаляет и его ЖК: пересчитывать нечего.
    ids := array(select c.id from new_rows r join public.complexes c on c.developer_id = r.id);
  end if;

  perform private.refresh_complex_states(array(select distinct x from unnest(ids) x where x is not null));
  return null;
end;
$$;

revoke all on function private.refresh_states_after() from public;

do $$
declare
  watched text;
begin
  foreach watched in array array[
    'complexes', 'media_assets', 'blocks', 'layouts', 'units', 'payment_programs', 'settings'
  ] loop
    execute format(
      'create trigger %1$s_z_state_insert after insert on public.%1$I
         referencing new table as new_rows
         for each statement execute function private.refresh_states_after()', watched);
    execute format(
      'create trigger %1$s_z_state_update after update on public.%1$I
         referencing old table as old_rows new table as new_rows
         for each statement execute function private.refresh_states_after()', watched);
    execute format(
      'create trigger %1$s_z_state_delete after delete on public.%1$I
         referencing old table as old_rows
         for each statement execute function private.refresh_states_after()', watched);
  end loop;
end;
$$;

-- Застройщик влияет на минимум только статусом (п. 3 «опубликованный застройщик»).
create trigger developers_z_state_update
  after update on public.developers
  referencing old table as old_rows new table as new_rows
  for each statement execute function private.refresh_states_after();

-- ─── Читатели: готовое значение вместо подсчёта ──────────────────────────────────────────
-- soon | full для сайта и предпросмотра — по хранимой полноте планировок (верно и для черновика,
-- которого сайт не покажет, а предпросмотр нарисует).
create or replace function private.complex_site_view(p_complex uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.layouts l join public.blocks b on b.id = l.block_id
      where b.complex_id = p_complex and l.is_complete
    ) then 'full'
    else 'soon'
  end
$$;

-- ─── Заполнить для существующих ЖК ───────────────────────────────────────────────────────
select private.refresh_complex_states(array(select c.id from public.complexes c));
