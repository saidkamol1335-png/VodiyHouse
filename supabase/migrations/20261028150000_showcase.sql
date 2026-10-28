-- Фаза 3 · шаг 3.16а: «Витрина» — спецпредложения, подборки и реклама (PLAN §3а «Витрина», §6
-- specials / collections / ads; решения 3б: виды без «скидки», карточка рекламы из данных, подборки
-- через ?podborka=, одно рекламное место по порядку руководителя — Г1 A).
-- База: три таблицы, обложки в media_assets (owner special / collection / ad), запрет слова
-- «скидка / chegirma» в текстах (на сайте скидок нет, PLAN §3.13), ЖК спецпредложения и рекламы —
-- только своего застройщика, удалённый ЖК уходит из массивов. Правит только руководитель
-- (PLAN п. 11), сайт видит действующее у опубликованных застройщиков. Чтение для сайта одной
-- функцией — шаг 3.16б.

-- ─── Виды и проверки ─────────────────────────────────────────────────────────────────────

create type public.special_kind as enum ('gift', 'installment', 'bank', 'sales_start');

-- На сайте скидок нет (PLAN §3.13): текст витрины со словом «скидка» база не принимает.
-- Та же проверка в кабинете — lib/admin/discountGuard.ts.
create function private.mentions_discount(value public.i18n_text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (value ->> 'ru') ~* '(скидк|chegirma|discount)' or (value ->> 'uz') ~* '(скидк|chegirma|discount)',
    false)
$$;

-- Период показа — по дате в Ташкенте: «до 05.11» кончается в ташкентскую полночь, а не в UTC.
create function private.tashkent_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tashkent')::date
$$;

-- Спецпредложение или реклама на сайте: включено, период идёт, застройщик опубликован.
create function private.showcase_visible(
  p_active boolean,
  p_from date,
  p_to date,
  p_developer uuid
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(p_active, false)
    and private.tashkent_today() between p_from and p_to
    and private.is_public_developer(p_developer)
$$;

revoke all on function
  private.mentions_discount(public.i18n_text),
  private.tashkent_today(),
  private.showcase_visible(boolean, date, date, uuid)
from public;
grant execute on function
  private.mentions_discount(public.i18n_text),
  private.tashkent_today(),
  private.showcase_visible(boolean, date, date, uuid)
to anon, authenticated, service_role;

-- ─── Таблицы ─────────────────────────────────────────────────────────────────────────────

-- Спецпредложения (ТЗ 8.5, мокап sp*): вид, бейдж на карточке ЖК, заголовок и текст, свои ЖК,
-- период. Фото — обложка в media_assets (без неё на сайте — обложка первого ЖК).
create table public.specials (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  kind public.special_kind not null,
  badge public.i18n_text not null check (not private.mentions_discount(badge)),
  title public.i18n_text not null check (not private.mentions_discount(title)),
  text public.i18n_text check (not private.mentions_discount(text)),
  -- Без внешнего ключа (как block_ids у программ): правка набора ЖК — одна запись журнала;
  -- удалённый ЖК уходит триггером. ЖК — только этого застройщика (триггер ниже).
  complex_ids uuid[] not null default '{}',
  valid_from date not null default current_date,
  valid_to date not null,
  is_active boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (cardinality(complex_ids) <= 20)
);

-- Подборки (мокап coll*): клик применяет набор к каталогу — вручную (список ЖК) или по фильтру.
-- filter — параметры адреса каталога как есть ({"komnat": "1,2", "do": "45000"}, lib/site/catalog/params.ts):
-- /novostroyki?podborka=slug открывает каталог с ними.
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 60),
  title public.i18n_text not null check (not private.mentions_discount(title)),
  mode text not null check (mode in ('manual', 'filter')),
  complex_ids uuid[] not null default '{}',
  filter jsonb not null default '{}' check (jsonb_typeof(filter) = 'object'),
  sort integer not null default 0,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(complex_ids) <= 30)
);

-- Реклама застройщика (мокап ad*, решение фазы 3): карточка из данных — ЖК или фильтр каталога,
-- «В продаже N», «Цена от» и «Платёж от» считает сайт; пометка «Реклама»; период. Одно место на
-- главной: показывается первая по sort из действующих (Г1 A).
create table public.ads (
  id uuid primary key default gen_random_uuid(),
  developer_id uuid not null references public.developers (id) on delete cascade,
  title public.i18n_text not null check (not private.mentions_discount(title)),
  text public.i18n_text check (not private.mentions_discount(text)),
  complex_ids uuid[] not null default '{}',
  filter jsonb not null default '{}' check (jsonb_typeof(filter) = 'object'),
  valid_from date not null default current_date,
  valid_to date not null,
  is_active boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_to >= valid_from),
  check (cardinality(complex_ids) <= 20)
);

create index specials_developer_idx on public.specials (developer_id);
create index specials_period_idx on public.specials (valid_to) where is_active;
create index ads_developer_idx on public.ads (developer_id);
create index ads_period_idx on public.ads (valid_to) where is_active;

comment on table public.specials is 'Спецпредложения витрины (3.16а): вид без «скидки», бейдж, период, ЖК застройщика.';
comment on table public.collections is 'Подборки ЖК на главной: вручную или по фильтру каталога, ?podborka=slug.';
comment on table public.ads is 'Реклама застройщиков: карточка из данных с пометкой «Реклама», одно место на главной по порядку.';

-- ─── ЖК витрины: существуют, у спецпредложения и рекламы — своего застройщика ────────────

-- Проверяются только добавленные ЖК (при смене застройщика — все): уборка после удаления ЖК
-- (forget_showcase_complex) идёт в конце оператора, когда соседние ЖК уже удалены, и не должна
-- спотыкаться о них.
create function private.check_showcase_complexes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidates uuid[] := new.complex_ids;
  stranger integer;
begin
  if tg_op = 'UPDATE' then
    candidates := array(
      select x.id from unnest(new.complex_ids) as x (id) where not (x.id = any (old.complex_ids)));
    if tg_table_name <> 'collections' then
      if new.developer_id is distinct from old.developer_id then
        candidates := new.complex_ids;
      end if;
    end if;
  end if;
  if tg_table_name = 'collections' then
    select count(*) into stranger
    from unnest(candidates) as x (id)
    where not exists (select 1 from public.complexes c where c.id = x.id);
  else
    select count(*) into stranger
    from unnest(candidates) as x (id)
    where not exists (
      select 1 from public.complexes c where c.id = x.id and c.developer_id = new.developer_id);
  end if;
  if stranger > 0 then
    raise exception 'ЖК не найден или принадлежит другому застройщику'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid', detail = 'complex_ids';
  end if;
  -- Повторы убираем, порядок руководителя сохраняем.
  new.complex_ids := array(
    select x.id from unnest(new.complex_ids) with ordinality as x (id, ord)
    group by x.id order by min(x.ord));
  return new;
end;
$$;

create trigger specials_check_complexes before insert or update of complex_ids, developer_id on public.specials
  for each row execute function private.check_showcase_complexes();
create trigger collections_check_complexes before insert or update of complex_ids on public.collections
  for each row execute function private.check_showcase_complexes();
create trigger ads_check_complexes before insert or update of complex_ids, developer_id on public.ads
  for each row execute function private.check_showcase_complexes();

-- Удалённый ЖК (окончательно, после архива) уходит из витрины; без ЖК спецпредложение сайт не
-- показывает (3.16б), в кабинете — видно «0 ЖК».
create function private.forget_showcase_complex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.specials set complex_ids = array_remove(complex_ids, old.id) where old.id = any (complex_ids);
  update public.collections set complex_ids = array_remove(complex_ids, old.id) where old.id = any (complex_ids);
  update public.ads set complex_ids = array_remove(complex_ids, old.id) where old.id = any (complex_ids);
  return old;
end;
$$;

create trigger complexes_forget_showcase
  after delete on public.complexes
  for each row execute function private.forget_showcase_complex();

-- ЖК перешёл к другому застройщику — из чужих спецпредложений и рекламы уходит.
create function private.forget_moved_showcase_complex()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.specials set complex_ids = array_remove(complex_ids, new.id)
    where developer_id = old.developer_id and new.id = any (complex_ids);
  update public.ads set complex_ids = array_remove(complex_ids, new.id)
    where developer_id = old.developer_id and new.id = any (complex_ids);
  return null;
end;
$$;

create trigger complexes_forget_moved_showcase
  after update of developer_id on public.complexes
  for each row when (new.developer_id is distinct from old.developer_id)
  execute function private.forget_moved_showcase_complex();

-- ─── Служебное: updated_at и журнал ───────────────────────────────────────────────────────

create trigger specials_set_updated_at before update on public.specials
  for each row execute function public.set_updated_at();
create trigger collections_set_updated_at before update on public.collections
  for each row execute function public.set_updated_at();
create trigger ads_set_updated_at before update on public.ads
  for each row execute function public.set_updated_at();

-- Спецпредложения и реклама — в журнале застройщика; подборки — только в общем журнале.
create or replace function private.audit_developer_id(entity text, row_data jsonb)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when entity = 'developers' then nullif(row_data ->> 'id', '')::uuid
    when entity in ('developer_past_projects', 'developer_private', 'media_assets', 'payment_programs', 'specials', 'ads')
      then nullif(row_data ->> 'developer_id', '')::uuid
  end
$$;

create trigger specials_audit after insert or update or delete on public.specials
  for each row execute function private.write_audit();
create trigger collections_audit after insert or update or delete on public.collections
  for each row execute function private.write_audit();
create trigger ads_audit after insert or update or delete on public.ads
  for each row execute function private.write_audit();

-- ─── Обложки витрины в media_assets ───────────────────────────────────────────────────────
-- Владелец файла — ещё и спецпредложение, подборка или реклама (PLAN §6 media_assets.owner);
-- вид — cover, одна на владельца. Папка в бакете — specials/<id>, collections/<id>, ads/<id>.

alter table public.media_assets
  add column special_id uuid references public.specials (id) on delete cascade,
  add column collection_id uuid references public.collections (id) on delete cascade,
  add column ad_id uuid references public.ads (id) on delete cascade;

-- Старые проверки «один владелец из двух», «logo и cover — у застройщика» и папка пути — заменяются.
do $$
declare
  old_check record;
begin
  for old_check in
    select conname
    from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) like '%num_nonnulls%'
        or pg_get_constraintdef(oid) like '%''logo''%'
        or conname = 'media_assets_path_in_owner_folder')
  loop
    execute format('alter table public.media_assets drop constraint %I', old_check.conname);
  end loop;
end;
$$;

drop function private.media_folder(uuid, uuid);

create function private.media_owner_folder(
  complex uuid,
  developer uuid,
  special uuid,
  collection uuid,
  ad uuid
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when complex is not null then 'complexes/' || complex
    when developer is not null then 'developers/' || developer
    when special is not null then 'specials/' || special
    when collection is not null then 'collections/' || collection
    else 'ads/' || ad
  end
$$;

revoke all on function private.media_owner_folder(uuid, uuid, uuid, uuid, uuid) from public;
grant execute on function private.media_owner_folder(uuid, uuid, uuid, uuid, uuid)
  to authenticated, service_role;

alter table public.media_assets
  add constraint media_assets_one_owner
    check (num_nonnulls(complex_id, developer_id, special_id, collection_id, ad_id) = 1),
  -- Логотип — у застройщика; обложка — у застройщика или витрины; фото, чертёж и фасад — у ЖК.
  add constraint media_assets_kind_by_owner
    check (
      case kind
        when 'logo' then developer_id is not null
        when 'cover' then complex_id is null
        else complex_id is not null
      end),
  add constraint media_assets_path_in_owner_folder
    check (starts_with(path, private.media_owner_folder(complex_id, developer_id, special_id, collection_id, ad_id) || '/'));

create unique index media_assets_one_special_cover_idx on public.media_assets (special_id) where kind = 'cover';
create unique index media_assets_one_collection_cover_idx on public.media_assets (collection_id) where kind = 'cover';
create unique index media_assets_one_ad_cover_idx on public.media_assets (ad_id) where kind = 'cover';

-- Политика Storage: путь — папка существующего владельца (тот же шаблон — lib/media/path.ts,
-- tests/db/storage.test.ts сверяет).
create or replace function private.is_media_path(object_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    object_name ~ '^(complexes|developers|specials|collections|ads)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png)$'
    and case split_part(object_name, '/', 1)
      when 'complexes' then exists (
        select 1 from public.complexes c where c.id::text = split_part(object_name, '/', 2))
      when 'developers' then exists (
        select 1 from public.developers d where d.id::text = split_part(object_name, '/', 2))
      when 'specials' then exists (
        select 1 from public.specials s where s.id::text = split_part(object_name, '/', 2))
      when 'collections' then exists (
        select 1 from public.collections c where c.id::text = split_part(object_name, '/', 2))
      else exists (
        select 1 from public.ads a where a.id::text = split_part(object_name, '/', 2))
    end,
    false
  )
$$;

-- Обложка витрины: файл браузер уже положил в бакет (политика Storage: руководитель, папка
-- владельца). Замена — одной транзакцией; путь старого файла возвращается серверу для Storage API.
-- Обложка уходит на сайт, как только запись включена, поэтому отметка правила 1.2 — на каждую
-- загрузку (решение 3.16а: при загрузке, а не при включении).
create function public.set_showcase_media(
  p_owner text,
  p_id uuid,
  p_path text,
  p_width integer,
  p_height integer,
  p_blur text,
  p_focus_x real default 0.5,
  p_focus_y real default 0.5,
  p_rule12 boolean default false
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Обложку витрины загружает руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_owner not in ('special', 'collection', 'ad') then
    raise exception 'Владелец обложки — спецпредложение, подборка или реклама'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  if not coalesce(p_rule12, false) then
    raise exception 'Отметьте, что на файле нет контактов застройщика (правило 1.2)'
      using errcode = 'check_violation', hint = 'vh:rule12';
  end if;
  if not exists (
    select 1 from public.specials s where p_owner = 'special' and s.id = p_id
    union all select 1 from public.collections c where p_owner = 'collection' and c.id = p_id
    union all select 1 from public.ads a where p_owner = 'ad' and a.id = p_id
  ) then
    raise exception 'Запись витрины не найдена' using errcode = 'no_data_found', hint = 'vh:not_found';
  end if;
  delete from public.media_assets m
  where m.kind = 'cover'
    and ((p_owner = 'special' and m.special_id = p_id)
      or (p_owner = 'collection' and m.collection_id = p_id)
      or (p_owner = 'ad' and m.ad_id = p_id))
  returning m.path into old_path;
  insert into public.media_assets (special_id, collection_id, ad_id, kind, path, width, height, blur, focus_x, focus_y)
  values (
    case when p_owner = 'special' then p_id end,
    case when p_owner = 'collection' then p_id end,
    case when p_owner = 'ad' then p_id end,
    'cover', p_path, p_width, p_height, p_blur, p_focus_x, p_focus_y);
  return old_path;
end;
$$;

create function public.remove_showcase_media(p_owner text, p_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  old_path text;
begin
  if not private.has_role('head') then
    raise exception 'Обложку витрины удаляет руководитель'
      using errcode = 'insufficient_privilege', hint = 'vh:forbidden';
  end if;
  if p_owner not in ('special', 'collection', 'ad') then
    raise exception 'Владелец обложки — спецпредложение, подборка или реклама'
      using errcode = 'invalid_parameter_value', hint = 'vh:invalid';
  end if;
  delete from public.media_assets m
  where m.kind = 'cover'
    and ((p_owner = 'special' and m.special_id = p_id)
      or (p_owner = 'collection' and m.collection_id = p_id)
      or (p_owner = 'ad' and m.ad_id = p_id))
  returning m.path into old_path;
  return old_path;
end;
$$;

comment on function public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean) is
  'Обложка спецпредложения, подборки или рекламы: заменяет прежнюю одной транзакцией, возвращает путь старого файла; нужна отметка правила 1.2.';
comment on function public.remove_showcase_media(text, uuid) is
  'Удаляет обложку витрины, возвращает путь файла для Storage API.';

revoke all on function
  public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean),
  public.remove_showcase_media(text, uuid)
from public, anon;
grant execute on function
  public.set_showcase_media(text, uuid, text, integer, integer, text, real, real, boolean),
  public.remove_showcase_media(text, uuid)
to authenticated;

revoke all on function
  private.check_showcase_complexes(),
  private.forget_showcase_complex(),
  private.forget_moved_showcase_complex()
from public;

-- ─── Права (PLAN §5, §3.11) ───────────────────────────────────────────────────────────────

alter table public.specials enable row level security;
alter table public.collections enable row level security;
alter table public.ads enable row level security;

revoke all on public.specials, public.collections, public.ads from anon, authenticated;
grant select on public.specials, public.collections, public.ads to anon, authenticated;
grant select, insert, update, delete on public.specials, public.collections, public.ads to authenticated;

create policy "specials: сайт — действующие у опубликованных, сотрудники — все"
  on public.specials for select to anon, authenticated
  using (private.showcase_visible(is_active, valid_from, valid_to, developer_id) or (select private.is_staff()));

create policy "collections: сайт — включённые, сотрудники — все"
  on public.collections for select to anon, authenticated
  using (is_active or (select private.is_staff()));

create policy "ads: сайт — действующие у опубликованных, сотрудники — все"
  on public.ads for select to anon, authenticated
  using (private.showcase_visible(is_active, valid_from, valid_to, developer_id) or (select private.is_staff()));

do $$
declare
  content_table text;
begin
  foreach content_table in array array['specials', 'collections', 'ads'] loop
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

-- ─── Архив: обложки витрины застройщика уходят вместе с ним ───────────────────────────────
-- archive_items (шаг 3.13) перечисляет файлы бакета для Storage API: у застройщика — ещё и
-- обложки его спецпредложений и рекламы (строки media_assets уйдут каскадом, файлы — только API).
create or replace function private.archive_items(p_from interval, p_to interval)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item order by item ->> 'archived_at'), '[]') from (
    select jsonb_build_object(
      'kind', 'complex', 'id', c.id, 'slug', c.slug, 'name', c.name, 'archived_at', c.archived_at,
      'purge_at', c.archived_at + interval '30 days',
      'complexes', jsonb_build_array(c.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m where m.complex_id = c.id)
    ) as item
    from public.complexes c
    join public.developers d on d.id = c.developer_id
    where c.status = 'archived' and d.status <> 'archived'
      and c.archived_at <= now() - p_from and c.archived_at > now() - p_to
    union all
    select jsonb_build_object(
      'kind', 'developer', 'id', d.id, 'slug', d.slug, 'name', d.name, 'archived_at', d.archived_at,
      'purge_at', d.archived_at + interval '30 days',
      'complexes', (select coalesce(jsonb_agg(c.id), '[]') from public.complexes c where c.developer_id = d.id),
      'media', (select coalesce(jsonb_agg(m.path), '[]') from public.media_assets m
                where m.developer_id = d.id
                   or m.complex_id in (select c.id from public.complexes c where c.developer_id = d.id)
                   or m.special_id in (select s.id from public.specials s where s.developer_id = d.id)
                   or m.ad_id in (select a.id from public.ads a where a.developer_id = d.id))
    )
    from public.developers d
    where d.status = 'archived' and d.archived_at <= now() - p_from and d.archived_at > now() - p_to
  ) as items;
$$;

-- ─── Журнал: запись витрины — своим заголовком ────────────────────────────────────────────
-- Та же функция, что в миграции 20261025200000, плюс specials / collections / ads: текущий
-- заголовок, у удалённой записи — из самой записи журнала.
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
