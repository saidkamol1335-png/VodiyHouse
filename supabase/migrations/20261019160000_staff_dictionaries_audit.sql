-- Фаза 1 · схема 1: сотрудники и роли, справочники, настройки, журнал изменений.
-- Права — PLAN §5. Каждая таблица закрывается явно (revoke + нужные grant): в облаке новые
-- таблицы public по умолчанию открыты ролям anon и authenticated, и тогда защищает только RLS.

-- ─── Общее ────────────────────────────────────────────────────────────────────────────────

-- Хелперы прав живут вне public: схема private не выставлена в Data API, вызвать их
-- напрямую через REST нельзя, а политики RLS — могут.
create schema private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

-- Двуязычный текст: оба языка обязательны и не пустые (PLAN §0.9, 3а), других ключей нет.
-- case — чтобы строка или число вместо объекта давали нарушение проверки, а не ошибку оператора;
-- coalesce — потому что без ключа сравнение даёт null, а null проверку домена проходит.
-- Пустое значение допустимо: обязательность задаёт not null у колонки.
create domain public.i18n_text as jsonb
  check (
    case
      when value is null then true
      when jsonb_typeof(value) = 'object' then coalesce(
        value - 'ru' - 'uz' = '{}'::jsonb
        and jsonb_typeof(value -> 'ru') = 'string'
        and jsonb_typeof(value -> 'uz') = 'string'
        and length(btrim(value ->> 'ru')) > 0
        and length(btrim(value ->> 'uz')) > 0,
        false
      )
      else false
    end
  );

-- ─── Сотрудники и роли (PLAN §3.3) ────────────────────────────────────────────────────────

create type public.staff_role as enum ('head', 'manager', 'videographer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 80),
  role public.staff_role not null,
  is_active boolean not null default true,
  -- Пароль выдаёт руководитель; при первом входе сотрудник ставит свой (решение фазы 1, в. 3).
  must_change_password boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Сотрудники Vodiy House. Создаёт сервер (ключ service_role) по команде руководителя; регистрации нет.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- security definer: читает profiles в обход RLS, иначе политика profiles звала бы саму себя.
create function private.staff_role()
returns public.staff_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid()) and p.is_active
$$;

comment on function private.staff_role() is
  'Роль текущего сотрудника; null — посетитель, чужой или отключённый пользователь.';

create function private.has_role(variadic allowed public.staff_role[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(private.staff_role() = any (allowed), false)
$$;

revoke all on function private.staff_role(), private.has_role(public.staff_role[]) from public;
grant execute on function private.staff_role(), private.has_role(public.staff_role[])
  to anon, authenticated, service_role;

-- Руководитель не может сам себя разжаловать или отключить — иначе кабинет останется без него.
create function private.guard_own_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or not new.is_active) then
    raise exception 'Нельзя поменять свою роль или отключить себя' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_own
  before update on public.profiles
  for each row execute function private.guard_own_profile();

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- Остальные поля (must_change_password) меняет только сервер.
grant update (full_name, role, is_active) on public.profiles to authenticated;

create policy "profiles: сотрудники видят команду, каждый — себя"
  on public.profiles for select to authenticated
  using ((select private.staff_role()) is not null or id = (select auth.uid()));

create policy "profiles: правит руководитель"
  on public.profiles for update to authenticated
  using ((select private.has_role('head')))
  with check ((select private.has_role('head')));

-- ─── Справочники (ТЗ 12, 13.2) ───────────────────────────────────────────────────────────

create type public.location_kind as enum ('city', 'district');

-- Город или район Ферганской области (ТЗ 1.4).
create table public.locations (
  id smallint generated always as identity primary key,
  kind public.location_kind not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.i18n_text not null,
  sort smallint not null default 0,
  is_active boolean not null default true
);

-- Документы ЖК (ТЗ 7.8): пояснение «что это значит для вас» утверждает заказчик.
create table public.document_types (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.i18n_text not null,
  hint public.i18n_text,
  sort smallint not null default 0,
  is_active boolean not null default true
);

-- Темы раздела «Детали проекта» (ТЗ 7.7).
create table public.detail_topics (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.i18n_text not null,
  sort smallint not null default 0,
  is_active boolean not null default true
);

-- Уровни отделки (ТЗ 4.4): описание «что входит» утверждает заказчик.
create table public.finishings (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name public.i18n_text not null,
  description public.i18n_text,
  sort smallint not null default 0,
  is_active boolean not null default true
);

-- Подсказки «?» к терминам (ТЗ 4.4).
create table public.hints (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  term public.i18n_text not null,
  text public.i18n_text not null,
  is_active boolean not null default true
);

-- Права у всех справочников одинаковые: читают все (фильтры сайта), скрытое видят только
-- сотрудники, правит руководитель (PLAN §5).
do $$
declare
  dictionary text;
begin
  foreach dictionary in array array['locations', 'document_types', 'detail_topics', 'finishings', 'hints'] loop
    execute format('alter table public.%I enable row level security', dictionary);
    execute format('revoke all on public.%I from anon, authenticated', dictionary);
    execute format('grant select on public.%I to anon, authenticated', dictionary);
    execute format('grant insert, update, delete on public.%I to authenticated', dictionary);
    execute format(
      'create policy "%s: читают все, скрытое — сотрудники" on public.%I for select to anon, authenticated
         using (is_active or (select private.staff_role()) is not null)', dictionary, dictionary);
    execute format(
      'create policy "%s: добавляет руководитель" on public.%I for insert to authenticated
         with check ((select private.has_role(''head'')))', dictionary, dictionary);
    execute format(
      'create policy "%s: правит руководитель" on public.%I for update to authenticated
         using ((select private.has_role(''head''))) with check ((select private.has_role(''head'')))',
      dictionary, dictionary);
    execute format(
      'create policy "%s: удаляет руководитель" on public.%I for delete to authenticated
         using ((select private.has_role(''head'')))', dictionary, dictionary);
  end loop;
end;
$$;

-- ─── Настройки (ТЗ 13.2) ─────────────────────────────────────────────────────────────────

create table public.settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$'),
  value jsonb not null,
  -- Публичные (номер VH, Telegram) читает сайт; остальные — только сотрудники.
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger settings_set_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

alter table public.settings enable row level security;
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;
grant insert, update, delete on public.settings to authenticated;

create policy "settings: публичные — все, остальные — руководитель и менеджер"
  on public.settings for select to anon, authenticated
  using (is_public or (select private.has_role('head', 'manager')));

create policy "settings: добавляет руководитель"
  on public.settings for insert to authenticated
  with check ((select private.has_role('head')));

create policy "settings: правит руководитель"
  on public.settings for update to authenticated
  using ((select private.has_role('head')))
  with check ((select private.has_role('head')));

create policy "settings: удаляет руководитель"
  on public.settings for delete to authenticated
  using ((select private.has_role('head')));

-- ─── Журнал изменений (ТЗ 13.1, PLAN 3а: «каждое действие пишется в журнал») ─────────────

create type public.audit_action as enum ('insert', 'update', 'delete');

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  -- null — сервер или SQL-консоль (без входа сотрудника).
  actor_id uuid references public.profiles (id) on delete set null,
  action public.audit_action not null,
  entity text not null,
  entity_id text not null,
  -- Для вкладки «Журнал» у ЖК. Без внешнего ключа намеренно: записи переживают окончательное
  -- удаление ЖК через 30 дней после архива (PLAN §3.12).
  complex_id uuid,
  -- update — только изменённые поля {поле: [было, стало]}; insert и delete — вся строка.
  changes jsonb not null
);

create index audit_log_at_idx on public.audit_log (at desc);
create index audit_log_complex_idx on public.audit_log (complex_id, at desc) where complex_id is not null;

-- К какому ЖК относится строка. Шаг 3 расширяет функцию для блоков, планировок и квартир.
create function private.audit_complex_id(entity text, row_data jsonb)
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(row_data ->> 'complex_id', '')::uuid
$$;

-- Пишет журнал за всех: security definer, потому что сам журнал закрыт на запись для ролей API.
create function private.write_audit()
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
begin
  -- DEMO-сид и его удаление (supabase/demo) — не действия сотрудников. Флаг ставится только
  -- прямым SQL: через Data API системную set_config не вызвать (схема pg_catalog не выставлена).
  if current_setting('vodiy.skip_audit', true) = 'on' then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(field.key, jsonb_build_array(old_row -> field.key, field.value)), '{}')
      into changes
      from jsonb_each(new_row) as field
      where field.value is distinct from old_row -> field.key
        and field.key not in ('updated_at', 'updated_by');
    -- Сохранение без изменений журнал не засоряет.
    if changes = '{}'::jsonb then
      return null;
    end if;
  else
    changes := row_data - 'created_at' - 'updated_at';
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, complex_id, changes)
  values (
    (select auth.uid()),
    lower(tg_op)::public.audit_action,
    tg_table_name,
    -- Ключ строки: id; у настроек — key; у таблиц «один к одному» (developer_private) — ссылка.
    coalesce(row_data ->> 'id', row_data ->> 'key', row_data ->> 'developer_id'),
    private.audit_complex_id(tg_table_name, row_data),
    changes
  );
  return null;
end;
$$;

revoke all on function private.write_audit(), private.audit_complex_id(text, jsonb) from public;

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

-- Журнал только дописывается: ни один сотрудник не может его править или чистить.
create policy "audit_log: читают руководитель и менеджер"
  on public.audit_log for select to authenticated
  using ((select private.has_role('head', 'manager')));

-- ─── Начальные данные справочников (не DEMO) ─────────────────────────────────────────────

-- Административное деление Ферганской области: 4 города областного подчинения и 15 районов.
insert into public.locations (kind, slug, name, sort) values
  ('city', 'fergana', '{"ru": "Фергана", "uz": "Farg‘ona"}', 10),
  ('city', 'kokand', '{"ru": "Коканд", "uz": "Qo‘qon"}', 20),
  ('city', 'margilan', '{"ru": "Маргилан", "uz": "Marg‘ilon"}', 30),
  ('city', 'kuvasay', '{"ru": "Кувасай", "uz": "Quvasoy"}', 40),
  ('district', 'altiarik', '{"ru": "Алтыарыкский район", "uz": "Oltiariq tumani"}', 110),
  ('district', 'bagdad', '{"ru": "Багдадский район", "uz": "Bag‘dod tumani"}', 120),
  ('district', 'beshariq', '{"ru": "Бешарыкский район", "uz": "Beshariq tumani"}', 130),
  ('district', 'buvayda', '{"ru": "Бувайдинский район", "uz": "Buvayda tumani"}', 140),
  ('district', 'dangara', '{"ru": "Дангаринский район", "uz": "Dang‘ara tumani"}', 150),
  ('district', 'fergana-district', '{"ru": "Ферганский район", "uz": "Farg‘ona tumani"}', 160),
  ('district', 'furqat', '{"ru": "Фуркатский район", "uz": "Furqat tumani"}', 170),
  ('district', 'qushtepa', '{"ru": "Куштепинский район", "uz": "Qo‘shtepa tumani"}', 180),
  ('district', 'quva', '{"ru": "Кувинский район", "uz": "Quva tumani"}', 190),
  ('district', 'rishtan', '{"ru": "Риштанский район", "uz": "Rishton tumani"}', 200),
  ('district', 'sokh', '{"ru": "Сохский район", "uz": "So‘x tumani"}', 210),
  ('district', 'tashlak', '{"ru": "Ташлакский район", "uz": "Toshloq tumani"}', 220),
  ('district', 'uchkuprik', '{"ru": "Учкуприкский район", "uz": "Uchko‘prik tumani"}', 230),
  ('district', 'uzbekistan', '{"ru": "Узбекистанский район", "uz": "O‘zbekiston tumani"}', 240),
  ('district', 'yazyavan', '{"ru": "Язъяванский район", "uz": "Yozyovon tumani"}', 250);

-- Публикуемый список документов — ТЗ 7.8; узбекские названия — словарь мокапа.
insert into public.document_types (slug, name, sort) values
  ('land', '{"ru": "Право на землю", "uz": "Yerga bo‘lgan huquq"}', 10),
  ('permit', '{"ru": "Разрешение на строительство", "uz": "Qurilish ruxsatnomasi"}', 20),
  ('declaration', '{"ru": "Проектная декларация", "uz": "Loyiha deklaratsiyasi"}', 30),
  ('expertise', '{"ru": "Заключение госэкспертизы", "uz": "Davlat ekspertizasi xulosasi"}', 40),
  ('seismic', '{"ru": "Заключение по сейсмостойкости", "uz": "Seysmik bardoshlilik xulosasi"}', 50),
  ('commissioning', '{"ru": "Акт ввода в эксплуатацию", "uz": "Foydalanishga topshirish dalolatnomasi"}', 60);

-- Темы по умолчанию — ТЗ 7.7; узбекские названия — перевод исполнителя (проверить носителем).
insert into public.detail_topics (slug, name, sort) values
  ('about', '{"ru": "О проекте", "uz": "Loyiha haqida"}', 10),
  ('quality', '{"ru": "Качество и стиль", "uz": "Sifat va uslub"}', 20),
  ('landscaping', '{"ru": "Благоустройство", "uz": "Obodonlashtirish"}', 30),
  ('amenities', '{"ru": "Функциональные помещения", "uz": "Funksional xonalar"}', 40),
  ('location', '{"ru": "Локация и внешняя инфраструктура", "uz": "Joylashuv va tashqi infratuzilma"}', 50),
  ('engineering', '{"ru": "Технологии строительства и инженерные решения", "uz": "Qurilish texnologiyalari va muhandislik yechimlari"}', 60);

-- Уровни отделки — ТЗ 4.4; узбекские названия — словарь мокапа, «без отделки» — перевод исполнителя.
insert into public.finishings (slug, name, sort) values
  ('none', '{"ru": "Без отделки", "uz": "Pardozsiz"}', 10),
  ('rough', '{"ru": "Черновая", "uz": "Qoralama"}', 20),
  ('white-box', '{"ru": "White box", "uz": "White box"}', 30),
  ('turnkey', '{"ru": "Под ключ", "uz": "Kalit tayyor"}', 40);

-- Журнал включается после начальных данных: стартовый набор — не действие сотрудника.
create trigger profiles_audit after insert or update or delete on public.profiles
  for each row execute function private.write_audit();
create trigger settings_audit after insert or update or delete on public.settings
  for each row execute function private.write_audit();
create trigger locations_audit after insert or update or delete on public.locations
  for each row execute function private.write_audit();
create trigger document_types_audit after insert or update or delete on public.document_types
  for each row execute function private.write_audit();
create trigger detail_topics_audit after insert or update or delete on public.detail_topics
  for each row execute function private.write_audit();
create trigger finishings_audit after insert or update or delete on public.finishings
  for each row execute function private.write_audit();
create trigger hints_audit after insert or update or delete on public.hints
  for each row execute function private.write_audit();
