-- Фаза 1 · схема 2а: застройщики, ЖК и медиафайлы (PLAN §6, ТЗ 12).
-- Права — PLAN §5: посетитель читает только опубликованное, сотрудники — всё, правит руководитель.
-- Видео, детали, документы ЖК и переносы сроков — вместе с мастером ЖК (фаза 3).

-- ─── Общее ────────────────────────────────────────────────────────────────────────────────

-- hidden — скрыт с сайта; archived — в архиве 30 дней, потом удаляется (PLAN §3.12).
create type public.publication_status as enum ('draft', 'published', 'hidden', 'archived');

create function private.is_staff()
returns boolean
language sql
stable
set search_path = ''
as $$
  select private.has_role('head', 'manager', 'videographer')
$$;

-- Дата архива ставится сама: по ней pg_cron удалит запись через 30 дней (фаза 3).
create function private.stamp_archived_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'archived' then
    new.archived_at := null;
  elsif tg_op = 'INSERT' or old.status is distinct from 'archived' then
    new.archived_at := now();
  end if;
  return new;
end;
$$;

-- ─── Застройщики ─────────────────────────────────────────────────────────────────────────

create table public.developers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Название бренда пишется латиницей одинаково на обоих языках (Farg‘ona Sifat Qurilish).
  name text not null check (length(btrim(name)) between 2 and 60),
  about public.i18n_text,
  founders public.i18n_text,
  founded_year smallint check (founded_year between 1950 and 2100),
  flats_delivered integer check (flats_delivered >= 0),
  -- «Проверено Vodiy House: есть сданные объекты» — дата проверки; null — не проверяли (ТЗ 8.4).
  delivered_checked_at date,
  status public.publication_status not null default 'draft',
  archived_at timestamptz,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null))
);

comment on table public.developers is
  'Застройщики. Контакты — только в developer_private: на сайт они не попадают (правило ТЗ 1.2).';

-- Сданные объекты, которых нет на сайте: план и факт сдачи (ТЗ 12, 8.6).
create table public.developer_past_projects (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  -- «Дом на ул. Мустакиллик, 14» / «Mustaqillik ko‘chasi, 14-uy» — название на двух языках.
  name public.i18n_text not null
    check (length(name ->> 'ru') <= 80 and length(name ->> 'uz') <= 80),
  planned_on date,
  delivered_on date,
  sort integer not null default 0
);

create index developer_past_projects_developer_idx on public.developer_past_projects (developer_id);

-- Внутренние контакты и заметки — никогда не публично (PLAN §5).
create table public.developer_private (
  developer_id uuid primary key references public.developers (id) on delete cascade,
  contacts text not null default '' check (length(contacts) <= 2000),
  notes text not null default '' check (length(notes) <= 4000),
  updated_at timestamptz not null default now()
);

create function private.is_public_developer(developer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.developers d where d.id = developer and d.status = 'published')
$$;

-- ─── ЖК ──────────────────────────────────────────────────────────────────────────────────

-- Наборы значений — из словаря мокапа (cls_*, house_*, park_*); подписи — в messages.
create type public.complex_class as enum ('econom', 'comfort', 'business', 'premium');
create type public.house_type as enum ('monolith', 'brick', 'frame');
create type public.parking_type as enum ('underground', 'ground', 'mixed');

create table public.complexes (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Лимиты под вёрстку карточки и страницы (PLAN 3а).
  name public.i18n_text not null
    check (length(name ->> 'ru') <= 28 and length(name ->> 'uz') <= 28),
  short_description public.i18n_text
    check (length(short_description ->> 'ru') <= 140 and length(short_description ->> 'uz') <= 140),
  class public.complex_class,
  location_id smallint references public.locations (id) on delete restrict,
  address public.i18n_text,
  -- В Фергане нет метро: «Ориентир» и «До центра: N мин» (ТЗ 1.4).
  landmark public.i18n_text,
  minutes_to_center smallint check (minutes_to_center between 0 and 240),
  lat numeric(8, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  house_type public.house_type,
  ceiling_height numeric(3, 2) check (ceiling_height between 2 and 6),
  floors_min smallint check (floors_min between 1 and 100),
  floors_max smallint check (floors_max between 1 and 100),
  parking public.parking_type,
  -- Удобство локации: [{kind, name: {ru, uz}, minutes}] — школы, детсады, мечети… (мокап, фаза 3).
  nearby jsonb not null default '[]' check (jsonb_typeof(nearby) = 'array'),
  -- Проверки Vodiy House с датой; null — не проверено (ТЗ 7.8).
  permit_checked_at date,
  land_checked_at date,
  staff_visited_at date,
  status public.publication_status not null default 'draft',
  archived_at timestamptz,
  -- Порядок в каталоге, перетаскиванием (PLAN 3а).
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'archived') = (archived_at is not null)),
  check (floors_min <= floors_max)
);

create index complexes_developer_idx on public.complexes (developer_id);
create index complexes_location_idx on public.complexes (location_id);
create index complexes_status_sort_idx on public.complexes (status, sort);

-- ЖК виден на сайте, только если опубликованы и он, и его застройщик.
create function private.is_public_complex(complex uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.id = complex and c.status = 'published' and d.status = 'published'
  )
$$;

-- Архивация застройщика архивирует все его ЖК (PLAN §3.12). Восстанавливаются они по одному.
create function private.archive_developer_complexes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'archived' and old.status is distinct from 'archived' then
    update public.complexes set status = 'archived' where developer_id = new.id and status <> 'archived';
  end if;
  return null;
end;
$$;

-- ─── Медиафайлы ──────────────────────────────────────────────────────────────────────────

-- Решение фазы 1 (в. 2): хранится один файл ≤ 3200 px без EXIF; размеры и AVIF/WebP делает
-- next/image. Кадры 16:9 / 4:3 / 4:5 считаются от точки фокуса (в. 4).
create type public.media_kind as enum ('photo', 'drawing', 'facade', 'logo', 'cover');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  complex_id uuid references public.complexes (id) on delete cascade,
  developer_id uuid references public.developers (id) on delete cascade,
  kind public.media_kind not null,
  path text not null unique check (length(path) between 3 and 300),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  -- Крошечное размытое превью (data URL) — заглушка, пока грузится фото.
  blur text check (length(blur) <= 4000),
  focus_x real not null default 0.5 check (focus_x between 0 and 1),
  focus_y real not null default 0.5 check (focus_y between 0 and 1),
  alt public.i18n_text,
  -- Галерея ЖК: первое фото по порядку — обложка (ТЗ 12).
  sort integer not null default 0,
  -- Кто загрузил — в журнале: колонки сотрудника здесь нет, таблицу читает сайт.
  created_at timestamptz not null default now(),
  check (num_nonnulls(complex_id, developer_id) = 1),
  -- Логотип и фон — у застройщика; фото, чертежи и фасад — у ЖК.
  check ((kind in ('logo', 'cover')) = (developer_id is not null))
);

create index media_assets_complex_idx on public.media_assets (complex_id, kind, sort);
create index media_assets_developer_idx on public.media_assets (developer_id, kind);
create unique index media_assets_one_logo_idx on public.media_assets (developer_id) where kind = 'logo';
create unique index media_assets_one_cover_idx on public.media_assets (developer_id) where kind = 'cover';
create unique index media_assets_one_facade_idx on public.media_assets (complex_id) where kind = 'facade';

-- ─── Триггеры ────────────────────────────────────────────────────────────────────────────

create trigger developers_set_updated_at before update on public.developers
  for each row execute function public.set_updated_at();
create trigger developer_private_set_updated_at before update on public.developer_private
  for each row execute function public.set_updated_at();
create trigger complexes_set_updated_at before update on public.complexes
  for each row execute function public.set_updated_at();

create trigger developers_stamp_archived_at before insert or update of status on public.developers
  for each row execute function private.stamp_archived_at();
create trigger complexes_stamp_archived_at before insert or update of status on public.complexes
  for each row execute function private.stamp_archived_at();

create trigger developers_archive_complexes after update of status on public.developers
  for each row execute function private.archive_developer_complexes();

create trigger developers_audit after insert or update or delete on public.developers
  for each row execute function private.write_audit();
create trigger developer_past_projects_audit after insert or update or delete on public.developer_past_projects
  for each row execute function private.write_audit();
create trigger developer_private_audit after insert or update or delete on public.developer_private
  for each row execute function private.write_audit();
create trigger complexes_audit after insert or update or delete on public.complexes
  for each row execute function private.write_audit();
create trigger media_assets_audit after insert or update or delete on public.media_assets
  for each row execute function private.write_audit();

revoke all on function
  private.is_staff(),
  private.is_public_developer(uuid),
  private.is_public_complex(uuid),
  private.stamp_archived_at(),
  private.archive_developer_complexes()
from public;
grant execute on function private.is_staff(), private.is_public_developer(uuid), private.is_public_complex(uuid)
  to anon, authenticated, service_role;

-- ─── Права (PLAN §5) ─────────────────────────────────────────────────────────────────────

alter table public.developers enable row level security;
alter table public.developer_past_projects enable row level security;
alter table public.developer_private enable row level security;
alter table public.complexes enable row level security;
alter table public.media_assets enable row level security;

revoke all on public.developers, public.developer_past_projects, public.developer_private,
  public.complexes, public.media_assets
from anon, authenticated;

grant select on public.developers, public.developer_past_projects, public.complexes, public.media_assets
  to anon, authenticated;
grant select, insert, update, delete on public.developers, public.developer_past_projects,
  public.developer_private, public.complexes, public.media_assets
to authenticated;

create policy "developers: сайт — опубликованные, сотрудники — все"
  on public.developers for select to anon, authenticated
  using (status = 'published' or (select private.is_staff()));

create policy "developer_past_projects: сайт — у опубликованных, сотрудники — все"
  on public.developer_past_projects for select to anon, authenticated
  using (private.is_public_developer(developer_id) or (select private.is_staff()));

create policy "developer_private: руководитель и менеджер"
  on public.developer_private for select to authenticated
  using ((select private.has_role('head', 'manager')));

create policy "complexes: сайт — опубликованные, сотрудники — все"
  on public.complexes for select to anon, authenticated
  using (
    (status = 'published' and private.is_public_developer(developer_id))
    or (select private.is_staff())
  );

create policy "media_assets: сайт — у опубликованных, сотрудники — все"
  on public.media_assets for select to anon, authenticated
  using (
    private.is_public_complex(complex_id)
    or private.is_public_developer(developer_id)
    or (select private.is_staff())
  );

-- Создаёт, публикует, архивирует и удаляет контент только руководитель (PLAN §3.11).
do $$
declare
  content_table text;
begin
  foreach content_table in array array[
    'developers', 'developer_past_projects', 'developer_private', 'complexes', 'media_assets'
  ] loop
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
