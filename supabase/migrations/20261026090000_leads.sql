-- Заявки (шаг 3.7, ТЗ 10, PLAN §5–§6): все формы сайта → leads; доставка по каналам — lead_deliveries
-- (Telegram-чат менеджеров, Google Таблица; CRM — 1б). Создаёт заявку только сервер сайта (секретный
-- ключ, после ловушки и лимита частоты): у посетителя прямого доступа нет. Читают и ведут — руководитель
-- и менеджер; видеограф заявок не видит (PLAN §5). Заявка переживает удаление ЖК: ссылки
-- `on delete set null`, названия — снимком (решение фазы 3).

create type public.lead_type as enum (
  'callback', 'view', 'complex', 'layout', 'documents', 'pick', 'partner', 'calc', 'tg',
  'consult', 'quiz', 'promo'
);
create type public.lead_status as enum ('new', 'work', 'called', 'meeting', 'deal', 'lost');
create type public.lead_channel as enum ('telegram', 'sheet');
create type public.lead_delivery_state as enum ('pending', 'sent', 'failed');

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  -- «Заявка #1045» (мокап CabLeads): номер для людей, id — для ссылок.
  number bigint generated always as identity (start with 1001) unique,
  created_at timestamptz not null default now(),
  type public.lead_type not null,
  -- У застройщика (форма «Застройщикам») — контактное лицо.
  name text not null check (length(btrim(name)) between 1 and 80),
  phone text not null check (phone ~ '^\+998[0-9]{9}$'),
  contact_lang text check (contact_lang in ('ru', 'uz')),
  site_lang text not null check (site_lang in ('ru', 'uz')),
  developer_id uuid references public.developers (id) on delete set null,
  complex_id uuid references public.complexes (id) on delete set null,
  block_id uuid references public.blocks (id) on delete set null,
  layout_id uuid references public.layouts (id) on delete set null,
  unit_id uuid references public.units (id) on delete set null,
  -- Снимок названий на момент заявки: {complex: {ru, uz}, slug, developer, block, layout: {rooms, area}}.
  subject jsonb not null default '{}' check (jsonb_typeof(subject) = 'object'),
  page_url text check (length(page_url) <= 500),
  -- Источник первого захода (ТЗ 10.3): utm_*, fbclid, gclid, referrer.
  source jsonb not null default '{}' check (jsonb_typeof(source) = 'object' and length(source::text) <= 2000),
  -- По типу: день и время просмотра, фильтры подбора, компания застройщика, строки расчёта, @ник.
  payload jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and length(payload::text) <= 4000),
  status public.lead_status not null default 'new',
  assigned_to uuid references public.profiles (id) on delete set null,
  -- Тот же номер по тому же ЖК за 24 часа (ТЗ 10.2): «повторное обращение».
  repeat_of uuid references public.leads (id) on delete set null,
  -- Хэш адреса посетителя (сервер, с солью) — только для лимита частоты; сам адрес не хранится.
  client_key text check (length(client_key) <= 128),
  -- Тревога «не дошла за 10 минут» уже ушла руководителю.
  alerted_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

create index leads_created_idx on public.leads (created_at desc);
create index leads_phone_idx on public.leads (phone, created_at desc);
create index leads_client_idx on public.leads (client_key, created_at desc) where client_key is not null;
create index leads_status_idx on public.leads (status);
create index leads_complex_idx on public.leads (complex_id);
create index leads_assigned_idx on public.leads (assigned_to);
create index leads_repeat_idx on public.leads (repeat_of);

create table public.lead_deliveries (
  lead_id uuid not null references public.leads (id) on delete cascade,
  channel public.lead_channel not null,
  state public.lead_delivery_state not null default 'pending',
  attempts smallint not null default 0 check (attempts >= 0),
  next_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text check (length(last_error) <= 300),
  primary key (lead_id, channel)
);

create index lead_deliveries_due_idx on public.lead_deliveries (next_at) where state = 'pending';

alter table public.leads enable row level security;
alter table public.lead_deliveries enable row level security;
revoke all on public.leads, public.lead_deliveries from anon, authenticated, service_role;
grant select on public.leads, public.lead_deliveries to authenticated;
-- Сервер (cron, бот) читает очередь доставки; пишет — только функциями ниже.
grant select on public.leads, public.lead_deliveries to service_role;

create policy "leads: руководитель и менеджер"
  on public.leads for select to authenticated
  using ((select private.has_role('head', 'manager')));

create policy "lead_deliveries: руководитель и менеджер"
  on public.lead_deliveries for select to authenticated
  using ((select private.has_role('head', 'manager')));

-- Снимок расчёта с сайта — вместе с заявкой (PLAN §6 calculations.lead_id).
alter table public.calculations
  add constraint calculations_lead_fk foreign key (lead_id) references public.leads (id) on delete set null;
create index calculations_lead_idx on public.calculations (lead_id) where lead_id is not null;

-- Снимки расчётов заявок (автора нет — посетитель) видят все, кто ведёт заявки.
create policy "calculations: снимки заявок — руководитель и менеджер"
  on public.calculations for select to authenticated
  using (lead_id is not null and (select private.has_role('head', 'manager')));

comment on table public.leads is 'Заявки с сайта (ТЗ 10). Создаёт только сервер — public.submit_lead.';
comment on table public.lead_deliveries is 'Доставка заявки по каналам: очередь повторов /api/cron (до 10 попыток за сутки).';
