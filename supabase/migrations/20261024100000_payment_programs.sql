-- Фаза 2 · шаг 2.2: банки, программы оплаты, курс USD/сум, снимки расчётов (PLAN §5, §6, v6;
-- решения фазы 2). Скидки видят только сотрудники: сайт читает программы функцией, которая полей
-- скидки не отдаёт вовсе (PLAN §3.13). Формулы — lib/calc; здесь — хранение, права и проверки.

-- ─── Банки (справочник «Настройки → Справочники») ─────────────────────────────────────────
-- Название — как у бренда, на двух языках (обычно одинаковое: «Ipoteka Bank»).
create table public.banks (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.i18n_text not null,
  sort smallint not null default 0,
  is_active boolean not null default true
);

-- Права — как у остальных справочников (20261019160000): читают все, скрытое — сотрудники.
alter table public.banks enable row level security;
revoke all on public.banks from anon, authenticated;
grant select on public.banks to anon, authenticated;
grant insert, update, delete on public.banks to authenticated;

create policy "banks: читают все, скрытое — сотрудники" on public.banks for select to anon, authenticated
  using (is_active or (select private.staff_role()) is not null);
create policy "banks: добавляет руководитель" on public.banks for insert to authenticated
  with check ((select private.has_role('head')));
create policy "banks: правит руководитель" on public.banks for update to authenticated
  using ((select private.has_role('head'))) with check ((select private.has_role('head')));
create policy "banks: удаляет руководитель" on public.banks for delete to authenticated
  using ((select private.has_role('head')));

create trigger banks_audit after insert or update or delete on public.banks
  for each row execute function private.write_audit();

-- Порядок и «удалить или скрыть» — общие функции справочников (20261020150000).
create or replace function private.dictionary_table(p_dictionary text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_dictionary in ('locations', 'document_types', 'detail_topics', 'finishings', 'banks') then
    return p_dictionary;
  end if;
  raise exception 'Нет такого справочника' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
end;
$$;

-- ─── Программы оплаты ─────────────────────────────────────────────────────────────────────

create type public.payment_program_type as enum ('full', 'installment', 'bank_installment', 'mortgage');
create type public.payment_method as enum ('tiers', 'markup', 'annuity', 'differentiated');
create type public.over_max_behavior as enum ('block', 'suggest_tier', 'lead');
create type public.program_blocks_scope as enum ('all', 'selected');

-- Набор полей зависит от типа и метода — проверяет private.check_payment_program. Названия у
-- программы нет: его собирает интерфейс (банк или тип + «· ЖК, блок»), решение фазы 2.
create table public.payment_programs (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  bank_id smallint references public.banks (id) on delete restrict,
  type public.payment_program_type not null,
  -- null — только у «100% оплаты».
  method public.payment_method,
  -- Скидка за 100 % — одно место (решение фазы 2); у остальных null.
  discount_pct numeric(5, 2),
  -- Мин. взнос у наценки и банков; у схемы — порог первой ступени tiers.
  min_down_pct numeric(5, 2),
  -- Схема: [{min_down_pct, discount_pct, min_months, max_months}] по возрастанию взноса.
  tiers jsonb not null default '[]',
  -- Наценка и банки: [{months, rate_pct}] — наценка за весь срок или годовая ставка.
  terms jsonb not null default '[]',
  -- [{name: appraisal | commission | insurance, kind: fixed | pct, value}].
  fees jsonb not null default '[]',
  -- Правила сроков (PLAN §3б) — только у схемы застройщика.
  preset_months smallint[] not null default '{}',
  allow_custom_months boolean not null default false,
  over_max_behavior public.over_max_behavior not null default 'block',
  -- Валюта банковской программы; программы застройщика считаются в валюте цены.
  currency public.currency,
  -- selected без блоков — программа не действует (решение фазы 2), а не «на все блоки».
  blocks_scope public.program_blocks_scope not null default 'all',
  block_ids uuid[] not null default '{}',
  conditions public.i18n_text,
  -- Новая программа выключена (Р4): на сайт её выпускает руководитель.
  is_active boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  -- Когда менялись условия (не порядок, тумблер или блоки): «Условия актуальны на» (Р5).
  updated_at timestamptz not null default now()
);

create index payment_programs_developer_idx on public.payment_programs (developer_id, sort);

comment on table public.payment_programs is
  'Программы оплаты застройщиков (PLAN §6). Скидки — только сотрудникам; сайт — site_payment_programs().';

-- «Условия проверены сегодня» (Р5): дата на сайте — позднее из правки программы и этой отметки.
alter table public.developers add column programs_checked_at timestamptz;

-- ─── Проверка условий: набор полей — по типу и методу ────────────────────────────────────

-- Число из jsonb в пределах (case — чтобы строка дала false, а не ошибку приведения).
create function private.json_number_between(
  p_value jsonb,
  p_min numeric,
  p_max numeric,
  p_integer boolean default false
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_value) = 'number' then
      (p_value::text)::numeric between p_min and p_max
      and (not p_integer or (p_value::text)::numeric = trunc((p_value::text)::numeric))
    else false
  end
$$;

-- Ступени схемы: 1–8, взнос — целые проценты, строго растёт (до 90 %: 100 % — программа
-- «100% оплата»). Целые — чтобы подсказка «24 мес. — при взносе 30–49 %» была точной.
create function private.valid_program_tiers(p_tiers jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  tier jsonb;
  previous numeric := -1;
begin
  if jsonb_typeof(p_tiers) is distinct from 'array' or jsonb_array_length(p_tiers) not between 1 and 8 then
    return false;
  end if;
  for tier in select value from jsonb_array_elements(p_tiers) loop
    if jsonb_typeof(tier) <> 'object' then
      return false;
    end if;
    if tier - 'min_down_pct' - 'discount_pct' - 'min_months' - 'max_months' <> '{}'::jsonb
       or not private.json_number_between(tier -> 'min_down_pct', 0, 90, true)
       or not private.json_number_between(tier -> 'discount_pct', 0, 50)
       or not private.json_number_between(tier -> 'min_months', 1, 600, true)
       or not private.json_number_between(tier -> 'max_months', 1, 600, true) then
      return false;
    end if;
    if (tier ->> 'min_down_pct')::numeric <= previous
       or (tier ->> 'max_months')::numeric < (tier ->> 'min_months')::numeric then
      return false;
    end if;
    previous := (tier ->> 'min_down_pct')::numeric;
  end loop;
  return true;
end;
$$;

-- Строки сроков: 1–12, месяцы строго растут; ставка или наценка — 0–100 %.
create function private.valid_program_terms(p_terms jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  term jsonb;
  previous numeric := 0;
begin
  if jsonb_typeof(p_terms) is distinct from 'array' or jsonb_array_length(p_terms) not between 1 and 12 then
    return false;
  end if;
  for term in select value from jsonb_array_elements(p_terms) loop
    if jsonb_typeof(term) <> 'object' then
      return false;
    end if;
    if term - 'months' - 'rate_pct' <> '{}'::jsonb
       or not private.json_number_between(term -> 'months', 1, 600, true)
       or not private.json_number_between(term -> 'rate_pct', 0, 100) then
      return false;
    end if;
    if (term ->> 'months')::numeric <= previous then
      return false;
    end if;
    previous := (term ->> 'months')::numeric;
  end loop;
  return true;
end;
$$;

-- Разовые: до 5, каждое — один раз; % — от суммы кредита (до 100), fixed — в валюте программы.
create function private.valid_program_fees(p_fees jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  fee jsonb;
  seen text[] := '{}';
begin
  if jsonb_typeof(p_fees) is distinct from 'array' or jsonb_array_length(p_fees) > 5 then
    return false;
  end if;
  for fee in select value from jsonb_array_elements(p_fees) loop
    if jsonb_typeof(fee) <> 'object' then
      return false;
    end if;
    if fee - 'name' - 'kind' - 'value' <> '{}'::jsonb
       or coalesce(fee ->> 'name', '') not in ('appraisal', 'commission', 'insurance')
       or (fee ->> 'name') = any (seen)
       or coalesce(fee ->> 'kind', '') not in ('fixed', 'pct')
       or not private.json_number_between(
         fee -> 'value', 0.01, case when fee ->> 'kind' = 'pct' then 100 else 999999999999 end) then
      return false;
    end if;
    seen := seen || (fee ->> 'name');
  end loop;
  return true;
end;
$$;

-- Что не так с программой — имя поля для detail; null — всё верно. Блоки проверяются только
-- добавленные: при удалении ЖК его блоки уходят из программ по одному (forget_program_block).
create function private.payment_program_problem(p public.payment_programs, p_old_blocks uuid[])
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  scheme boolean := p.type = 'installment' and p.method is not distinct from 'tiers';
  bank boolean := p.type in ('bank_installment', 'mortgage');
  plain boolean := p.type = 'full' or scheme;
begin
  if not coalesce((p.type = 'full' and p.method is null) or scheme
          or (p.type = 'installment' and p.method is not distinct from 'markup')
          or (bank and p.method in ('annuity', 'differentiated')), false) then
    return 'method';
  end if;
  if (p.bank_id is null) = bank then return 'bank'; end if;
  if (p.currency is null) = bank then return 'currency'; end if;
  if (p.discount_pct is null) = (p.type = 'full') or p.discount_pct not between 0 and 50 then
    return 'discount_pct';
  end if;
  if (p.min_down_pct is null) <> plain or p.min_down_pct not between 0 and 90
     or p.min_down_pct <> trunc(p.min_down_pct) then
    return 'min_down_pct';
  end if;
  if (scheme and not private.valid_program_tiers(p.tiers)) or (not scheme and p.tiers <> '[]') then
    return 'tiers';
  end if;
  if (plain and p.terms <> '[]') or (not plain and not private.valid_program_terms(p.terms)) then
    return 'terms';
  end if;
  if (plain and p.fees <> '[]') or (not plain and not private.valid_program_fees(p.fees)) then
    return 'fees';
  end if;
  -- Фиксированная сумма — «в валюте программы», а у наценки своей валюты нет (валюта блока).
  if p.method is not distinct from 'markup' and p.fees @> '[{"kind": "fixed"}]' then
    return 'fees';
  end if;
  if (not scheme and (p.preset_months <> '{}' or p.allow_custom_months))
     or coalesce(array_ndims(p.preset_months), 1) > 1
     or array_position(p.preset_months, null) is not null
     or not p.preset_months <@ '{12, 24, 36, 48}'::smallint[]
     or cardinality(p.preset_months) <> (select count(distinct m) from unnest(p.preset_months) m) then
    return 'preset_months';
  end if;
  if (p.blocks_scope = 'all' and p.block_ids <> '{}') or cardinality(p.block_ids) > 100
     or coalesce(array_ndims(p.block_ids), 1) > 1
     -- count(distinct) не считает ни повторы, ни null — оба дают расхождение с cardinality
     or cardinality(p.block_ids) <> (select count(distinct b) from unnest(p.block_ids) b)
     or exists (
       select 1 from unnest(p.block_ids) as added (id)
       where added.id <> all (p_old_blocks) and not exists (
         select 1 from public.blocks b join public.complexes c on c.id = b.complex_id
         where b.id = added.id and c.developer_id = p.developer_id and c.status <> 'archived')) then
    return 'blocks';
  end if;
  return null;
end;
$$;

create function private.check_payment_program()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  field text := private.payment_program_problem(
    new, case when tg_op = 'UPDATE' then old.block_ids else '{}' end);
begin
  if field is not null then
    raise exception 'Условия программы заполнены неверно'
      using errcode = 'check_violation', hint = 'vh:invalid_program', detail = field;
  end if;
  if tg_op = 'UPDATE' and (new.type, new.method, new.bank_id, new.discount_pct, new.min_down_pct,
      new.tiers, new.terms, new.fees, new.preset_months, new.allow_custom_months,
      new.over_max_behavior, new.currency, new.conditions)
    is distinct from (old.type, old.method, old.bank_id, old.discount_pct, old.min_down_pct,
      old.tiers, old.terms, old.fees, old.preset_months, old.allow_custom_months,
      old.over_max_behavior, old.currency, old.conditions) then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger payment_programs_check
  before insert or update on public.payment_programs
  for each row execute function private.check_payment_program();

-- Застройщик не остаётся без программ (мокап: «Нельзя выключить все программы»); удалить можно
-- только выключенную (Р4). Каскад при окончательном удалении застройщика не задерживается.
create function private.guard_payment_program()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.developer_id <> old.developer_id then
    raise exception 'Программу нельзя перенести к другому застройщику'
      using errcode = 'check_violation', hint = 'vh:invalid_program', detail = 'developer';
  end if;
  if tg_op = 'DELETE' then
    if old.is_active and exists (select 1 from public.developers d where d.id = old.developer_id) then
      raise exception 'Удалить можно только выключенную программу'
        using errcode = 'check_violation', hint = 'vh:program_active';
    end if;
    return old;
  end if;
  if old.is_active and not new.is_active then
    -- Два выключения разом не оставят застройщика без программ: второе ждёт первое.
    perform pg_advisory_xact_lock(hashtextextended('payment_programs:' || old.developer_id::text, 0));
    if not exists (
      select 1 from public.payment_programs p
      where p.developer_id = old.developer_id and p.is_active and p.id <> old.id
    ) then
      raise exception 'У застройщика должна остаться хотя бы одна программа'
        using errcode = 'check_violation', hint = 'vh:last_program';
    end if;
  end if;
  return new;
end;
$$;

create trigger payment_programs_guard
  before update or delete on public.payment_programs
  for each row execute function private.guard_payment_program();

-- Удалённый блок уходит из программ (массив без внешнего ключа: так правка блоков — одна запись
-- журнала у программы). «Выбранные» без блоков — программа не действует до правки.
create function private.forget_program_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_programs
    set block_ids = array_remove(block_ids, old.id)
    where old.id = any (block_ids);
  return old;
end;
$$;

create trigger blocks_forget_program_block
  after delete on public.blocks
  for each row execute function private.forget_program_block();

create function private.forget_moved_complex_blocks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_programs p
    set block_ids = array(
      select x.id from unnest(p.block_ids) with ordinality as x (id, ord)
      where x.id not in (select b.id from public.blocks b where b.complex_id = new.id)
      order by x.ord)
    where p.developer_id = old.developer_id
      and p.block_ids && array(select b.id from public.blocks b where b.complex_id = new.id);
  return null;
end;
$$;

create trigger complexes_forget_program_blocks
  after update of developer_id on public.complexes
  for each row when (new.developer_id is distinct from old.developer_id)
  execute function private.forget_moved_complex_blocks();

revoke all on function
  private.json_number_between(jsonb, numeric, numeric, boolean),
  private.valid_program_tiers(jsonb),
  private.valid_program_terms(jsonb),
  private.valid_program_fees(jsonb),
  private.payment_program_problem(public.payment_programs, uuid[]),
  private.check_payment_program(),
  private.guard_payment_program(),
  private.forget_program_block(),
  private.forget_moved_complex_blocks()
from public;
grant execute on function
  private.json_number_between(jsonb, numeric, numeric, boolean),
  private.valid_program_tiers(jsonb),
  private.valid_program_terms(jsonb),
  private.valid_program_fees(jsonb),
  private.payment_program_problem(public.payment_programs, uuid[])
to authenticated;

-- ─── Права и журнал программ ──────────────────────────────────────────────────────────────
-- Таблицу читают только руководитель и менеджер (там скидки); сайт — site_payment_programs().
alter table public.payment_programs enable row level security;
revoke all on public.payment_programs from anon, authenticated;
grant select, insert, update, delete on public.payment_programs to authenticated;

create policy "payment_programs: читают руководитель и менеджер"
  on public.payment_programs for select to authenticated
  using ((select private.has_role('head', 'manager')));
create policy "payment_programs: добавляет руководитель"
  on public.payment_programs for insert to authenticated
  with check ((select private.has_role('head')));
create policy "payment_programs: правит руководитель"
  on public.payment_programs for update to authenticated
  using ((select private.has_role('head'))) with check ((select private.has_role('head')));
create policy "payment_programs: удаляет руководитель"
  on public.payment_programs for delete to authenticated
  using ((select private.has_role('head')));

-- Программы — в журнале застройщика (PLAN §3б: «изменение пишется в журнал»).
create or replace function private.audit_developer_id(entity text, row_data jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when entity = 'developers' then nullif(row_data ->> 'id', '')::uuid
    when entity in ('developer_past_projects', 'developer_private', 'media_assets', 'payment_programs')
      then nullif(row_data ->> 'developer_id', '')::uuid
  end
$$;

create trigger payment_programs_audit after insert or update or delete on public.payment_programs
  for each row execute function private.write_audit();

-- ─── Кабинет: правка программ (Р2–Р5) ─────────────────────────────────────────────────────
-- Функции security invoker: права — политики выше, проверка роли — первой строкой.

-- Создание (без id) или правка всей карточки. Новая — выключенная, в конце панели застройщика.
create function public.save_payment_program(p_program jsonb)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  program_id uuid;
  fields public.payment_programs;
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  begin
    program_id := nullif(p_program ->> 'id', '')::uuid;
    fields := jsonb_populate_record(null::public.payment_programs, p_program - 'id');
  exception when others then
    raise exception 'Условия программы заполнены неверно'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid_program', detail = 'format';
  end;
  if program_id is null then
    if not exists (
      select 1 from public.developers d where d.id = fields.developer_id and d.status <> 'archived'
    ) then
      raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
    end if;
    insert into public.payment_programs (
      developer_id, bank_id, type, method, discount_pct, min_down_pct, tiers, terms, fees,
      preset_months, allow_custom_months, over_max_behavior, currency, blocks_scope, block_ids,
      conditions, sort
    )
    values (
      fields.developer_id, fields.bank_id, fields.type, fields.method, fields.discount_pct,
      fields.min_down_pct, coalesce(fields.tiers, '[]'), coalesce(fields.terms, '[]'),
      coalesce(fields.fees, '[]'), coalesce(fields.preset_months, '{}'),
      coalesce(fields.allow_custom_months, false), coalesce(fields.over_max_behavior, 'block'),
      fields.currency, coalesce(fields.blocks_scope, 'all'), coalesce(fields.block_ids, '{}'),
      fields.conditions,
      (select coalesce(max(p.sort), 0) + 10 from public.payment_programs p
        where p.developer_id = fields.developer_id)
    )
    returning id into program_id;
    return program_id;
  end if;
  update public.payment_programs
    set bank_id = fields.bank_id, type = fields.type, method = fields.method,
        discount_pct = fields.discount_pct, min_down_pct = fields.min_down_pct,
        tiers = coalesce(fields.tiers, '[]'), terms = coalesce(fields.terms, '[]'),
        fees = coalesce(fields.fees, '[]'), preset_months = coalesce(fields.preset_months, '{}'),
        allow_custom_months = coalesce(fields.allow_custom_months, false),
        over_max_behavior = coalesce(fields.over_max_behavior, 'block'),
        currency = fields.currency, blocks_scope = coalesce(fields.blocks_scope, 'all'),
        block_ids = coalesce(fields.block_ids, '{}'), conditions = fields.conditions
    where id = program_id;
  if not found then
    raise exception 'Программа не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return program_id;
end;
$$;

-- Тумблер «на сайте» (мокап CabProg); последнюю включённую не выключить — guard_payment_program.
create function public.set_payment_program_active(p_program uuid, p_active boolean)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  update public.payment_programs set is_active = p_active where id = p_program;
  if not found then
    raise exception 'Программа не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

create function public.delete_payment_program(p_program uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  delete from public.payment_programs where id = p_program;
  if not found then
    raise exception 'Программа не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

-- «Скопировать к другому застройщику» (Р3): копия выключена; блоки чужого застройщика не
-- подходят — у копии «все блоки».
create function public.copy_payment_program(p_program uuid, p_developer uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  copy_id uuid;
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if not exists (select 1 from public.developers d where d.id = p_developer and d.status <> 'archived') then
    raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  insert into public.payment_programs (
    developer_id, bank_id, type, method, discount_pct, min_down_pct, tiers, terms, fees,
    preset_months, allow_custom_months, over_max_behavior, currency, blocks_scope, block_ids,
    conditions, sort
  )
  select p_developer, p.bank_id, p.type, p.method, p.discount_pct, p.min_down_pct, p.tiers, p.terms,
         p.fees, p.preset_months, p.allow_custom_months, p.over_max_behavior, p.currency,
         case when p.developer_id = p_developer then p.blocks_scope else 'all' end,
         case when p.developer_id = p_developer then p.block_ids else '{}' end,
         p.conditions,
         (select coalesce(max(o.sort), 0) + 10 from public.payment_programs o where o.developer_id = p_developer)
  from public.payment_programs p
  where p.id = p_program
  returning id into copy_id;
  if copy_id is null then
    raise exception 'Программа не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  return copy_id;
end;
$$;

-- Порядок карточек в панели застройщика (стрелки): все id в новом порядке.
create function public.reorder_payment_programs(p_developer uuid, p_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  update public.payment_programs as p set sort = x.ord * 10
    from unnest(p_ids) with ordinality as x (id, ord)
    where p.id = x.id and p.developer_id = p_developer and p.sort is distinct from x.ord * 10;
end;
$$;

-- «Условия проверены сегодня» (Р5): условия сверены с застройщиком и банками, правок нет.
create function public.mark_programs_checked(p_developer uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not private.has_role('head') then
    raise exception 'Программы оплаты правит руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  update public.developers set programs_checked_at = now() where id = p_developer;
  if not found then
    raise exception 'Застройщик не найден' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
end;
$$;

-- Экран «Программы оплаты»: панели застройщиков (кроме архива) с программами целиком (у сотрудников
-- — со скидками) и блоками для выбора. Руководитель и менеджер; остальным — пустой список.
create function public.payment_program_panels()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(panel.data order by panel.sort, panel.name), '[]'::jsonb)
  from (
    select d.sort, d.name, jsonb_build_object(
      'id', d.id, 'slug', d.slug, 'name', d.name, 'status', d.status,
      'programs_checked_at', d.programs_checked_at,
      'blocks', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', b.id, 'name', b.name, 'complex_id', c.id, 'complex_name', c.name, 'currency', b.currency
        ) order by c.sort, b.sort, b.name), '[]'::jsonb)
        from public.complexes c
        join public.blocks b on b.complex_id = c.id
        where c.developer_id = d.id and c.status <> 'archived'),
      'programs', (
        select coalesce(jsonb_agg(
          to_jsonb(p) || jsonb_build_object('bank', (select bk.name from public.banks bk where bk.id = p.bank_id))
          order by p.sort, p.created_at), '[]'::jsonb)
        from public.payment_programs p
        where p.developer_id = d.id)
    ) as data
    from public.developers d
    where d.status <> 'archived' and (select private.has_role('head', 'manager'))
  ) as panel
$$;

comment on function public.save_payment_program(jsonb) is
  'Карточка программы целиком: без id — новая (выключена), с id — правка. Проверка — check_payment_program.';
comment on function public.payment_program_panels() is
  'Панели «Программ оплаты»: застройщики без архива, их программы и блоки. Руководитель и менеджер.';

revoke all on function
  public.save_payment_program(jsonb),
  public.set_payment_program_active(uuid, boolean),
  public.delete_payment_program(uuid),
  public.copy_payment_program(uuid, uuid),
  public.reorder_payment_programs(uuid, uuid[]),
  public.mark_programs_checked(uuid),
  public.payment_program_panels()
from public, anon;
grant execute on function
  public.save_payment_program(jsonb),
  public.set_payment_program_active(uuid, boolean),
  public.delete_payment_program(uuid),
  public.copy_payment_program(uuid, uuid),
  public.reorder_payment_programs(uuid, uuid[]),
  public.mark_programs_checked(uuid),
  public.payment_program_panels()
to authenticated;

-- Курс ЦБ по расписанию пишет сервер (service_role): своих прав на таблицы у него нет (как у
-- profiles, 20261020120000) — только на настройки.
grant select, insert, update on public.settings to service_role;

-- ─── Курс USD/сум (PLAN §7 фаза 2, Р6) ───────────────────────────────────────────────────
-- settings 'exchange.usd_uzs' = {cbu: {usd_uzs, date} | null, manual: {usd_uzs, date} | null};
-- действует ручной, если он есть. Ключ публичный: курс нужен калькулятору сайта.

create function private.exchange_rate()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when jsonb_typeof(s.value -> 'manual') = 'object' then (s.value -> 'manual') || '{"source": "manual"}'
    when jsonb_typeof(s.value -> 'cbu') = 'object' then (s.value -> 'cbu') || '{"source": "cbu"}'
  end
  from public.settings s
  where s.key = 'exchange.usd_uzs'
$$;

revoke all on function private.exchange_rate() from public;
grant execute on function private.exchange_rate() to anon, authenticated, service_role;

create function private.check_exchange_rate(p_rate numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_rate is null or p_rate not between 1000 and 100000 then
    raise exception 'Курс должен быть от 1 000 до 100 000 сум за доллар'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid_rate';
  end if;
end;
$$;

revoke all on function private.check_exchange_rate(numeric) from public;
grant execute on function private.check_exchange_rate(numeric) to authenticated, service_role;

-- Курс ЦБ: загрузка по расписанию (service_role), команда (SQL) или «Обновить» руководителя.
-- Ежедневное обновление сервером — не правка сотрудника, в журнал не пишется; руководитель
-- пишет курс сам — запись в журнале есть. Ответ — изменился ли курс.
create function public.set_cbu_exchange_rate(p_rate numeric, p_date date)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  rate jsonb := jsonb_build_object('usd_uzs', p_rate, 'date', p_date);
  changed boolean;
  audit_was text := coalesce(current_setting('vodiy.skip_audit', true), 'off');
begin
  if not (private.has_role('head') or current_user in ('service_role', 'postgres')) then
    raise exception 'Курс обновляет руководитель или сервер'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  perform private.check_exchange_rate(p_rate);
  -- ЦБ публикует курс и на завтра; дальше — ошибка источника.
  if p_date is null or p_date > (now() at time zone 'Asia/Tashkent')::date + 1 then
    raise exception 'Неверная дата курса' using errcode = 'invalid_parameter_value', hint = 'vh:invalid_rate';
  end if;
  if current_user in ('service_role', 'postgres') then
    perform set_config('vodiy.skip_audit', 'on', true);
  end if;
  insert into public.settings (key, value, is_public)
  values ('exchange.usd_uzs', jsonb_build_object('cbu', rate, 'manual', null), true)
  on conflict (key) do update
    set value = (public.settings.value - 'demo') || jsonb_build_object('cbu', rate)
    where public.settings.value -> 'cbu' is distinct from rate or public.settings.value ? 'demo';
  changed := found;
  perform set_config('vodiy.skip_audit', audit_was, true);
  return changed;
end;
$$;

-- Ручной курс (Р6): до «Вернуть курс ЦБ» (p_rate = null). Правка руководителя — в журнал.
create function public.set_manual_exchange_rate(p_rate numeric)
returns void
language plpgsql
set search_path = ''
as $$
declare
  manual jsonb;
begin
  if not private.has_role('head') then
    raise exception 'Курс фиксирует руководитель' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_rate is not null then
    perform private.check_exchange_rate(p_rate);
    manual := jsonb_build_object('usd_uzs', p_rate, 'date', (now() at time zone 'Asia/Tashkent')::date);
  end if;
  insert into public.settings (key, value, is_public)
  values ('exchange.usd_uzs', jsonb_build_object('cbu', null, 'manual', coalesce(manual, 'null'::jsonb)), true)
  on conflict (key) do update
    set value = (public.settings.value - 'demo') || jsonb_build_object('manual', coalesce(manual, 'null'::jsonb));
end;
$$;

revoke all on function public.set_cbu_exchange_rate(numeric, date), public.set_manual_exchange_rate(numeric)
  from public, anon;
grant execute on function public.set_cbu_exchange_rate(numeric, date) to authenticated, service_role;
grant execute on function public.set_manual_exchange_rate(numeric) to authenticated;

-- ─── Сайт: программы без скидок (PLAN §3.13) ─────────────────────────────────────────────

-- Блоки программы, которые видит сайт (ЖК и застройщик опубликованы).
create function private.public_block_ids(p_blocks uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(b.id order by b.id), '{}')
  from public.blocks b
  where b.id = any (p_blocks) and private.is_public_complex(b.complex_id)
$$;

-- Программа для сайта: полей скидки нет вовсе — ни у «100% оплаты», ни у ступеней схемы.
create function private.site_program(p public.payment_programs, p_checked_at timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'type', p.type, 'method', p.method,
    'bank', (select b.name from public.banks b where b.id = p.bank_id),
    'min_down_pct', p.min_down_pct,
    'tiers', (select coalesce(jsonb_agg(t.value - 'discount_pct' order by t.ordinality), '[]'::jsonb)
              from jsonb_array_elements(p.tiers) with ordinality as t),
    'terms', p.terms, 'fees', p.fees,
    'preset_months', to_jsonb(p.preset_months), 'allow_custom_months', p.allow_custom_months,
    'over_max_behavior', p.over_max_behavior, 'currency', p.currency,
    'blocks_scope', p.blocks_scope, 'block_ids', to_jsonb(private.public_block_ids(p.block_ids)),
    'conditions', p.conditions,
    -- «Условия актуальны на» (Р5): позднее из правки и отметки «проверены».
    'updated_at', greatest(p.updated_at, p_checked_at)
  )
$$;

-- Калькулятор сайта: курс и опубликованные застройщики с включёнными программами; программа на
-- выбранных блоках видна, пока хотя бы один из них на сайте.
create function public.site_payment_programs()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rate', private.exchange_rate(),
    'developers', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'slug', d.slug, 'name', d.name, 'programs', listed.programs)
                       order by d.sort, d.name)
      from public.developers d
      cross join lateral (
        select jsonb_agg(private.site_program(p, d.programs_checked_at) order by p.sort, p.created_at) as programs
        from public.payment_programs p
        where p.developer_id = d.id and p.is_active
          and (p.blocks_scope = 'all' or cardinality(private.public_block_ids(p.block_ids)) > 0)
      ) as listed
      where d.status = 'published' and listed.programs is not null
    ), '[]'::jsonb)
  )
$$;

comment on function public.site_payment_programs() is
  'Калькулятор сайта: курс и программы опубликованных застройщиков — без полей скидки (PLAN §3.13).';

revoke all on function
  private.public_block_ids(uuid[]),
  private.site_program(public.payment_programs, timestamptz),
  public.site_payment_programs()
from public;
grant execute on function public.site_payment_programs() to anon, authenticated, service_role;

-- ─── Снимки расчётов (PLAN §6 calculations, §5) ──────────────────────────────────────────
-- Кабинет пишет снимок при «Скопировать для Telegram»; сайт — вместе с заявкой (фаза 3,
-- тогда же внешний ключ lead_id). Не журналируются: это и есть журнал расчётов.

create type public.calc_channel as enum ('site', 'cabinet');

create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  channel public.calc_channel not null,
  program_id uuid references public.payment_programs (id) on delete set null,
  unit_id uuid references public.units (id) on delete set null,
  lead_id uuid,
  input jsonb not null check (jsonb_typeof(input) = 'object'),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  -- Условия на момент расчёта: программа меняется и удаляется, снимок — нет (Р4).
  program_snapshot jsonb not null check (jsonb_typeof(program_snapshot) = 'object'),
  rate jsonb
);

create index calculations_author_idx on public.calculations (created_by, created_at desc);

alter table public.calculations enable row level security;
revoke all on public.calculations from anon, authenticated;
grant select on public.calculations to authenticated;

create policy "calculations: руководитель — все, менеджер — свои"
  on public.calculations for select to authenticated
  using ((select private.has_role('head'))
         or (created_by = (select auth.uid()) and (select private.has_role('manager'))));

-- Снимок условий и курса берётся из базы, а не от клиента.
create function public.save_calculation(p_program uuid, p_unit uuid, p_input jsonb, p_result jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  saved_id uuid;
begin
  if not private.has_role('head', 'manager') then
    raise exception 'Расчёт сохраняет сотрудник' using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if jsonb_typeof(p_input) is distinct from 'object' or jsonb_typeof(p_result) is distinct from 'object'
     or length(p_input::text) > 10000 or length(p_result::text) > 20000 then
    raise exception 'Расчёт не сохранить' using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  select to_jsonb(p) || jsonb_build_object('bank', b.name)
    into snapshot
    from public.payment_programs p
    left join public.banks b on b.id = p.bank_id
    where p.id = p_program;
  if snapshot is null then
    raise exception 'Программа не найдена — обновите страницу' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  if p_unit is not null and not exists (select 1 from public.units u where u.id = p_unit) then
    raise exception 'Квартира не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  insert into public.calculations (created_by, channel, program_id, unit_id, input, result, program_snapshot, rate)
  values ((select auth.uid()), 'cabinet', p_program, p_unit, p_input, p_result, snapshot, private.exchange_rate())
  returning id into saved_id;
  return saved_id;
end;
$$;

revoke all on function public.save_calculation(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.save_calculation(uuid, uuid, jsonb, jsonb) to authenticated;
