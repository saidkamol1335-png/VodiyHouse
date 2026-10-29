-- DEMO-посещения и DEMO-заявки для «Статистики сайта» (фаза 6, мокап CabStats): 60 дней по
-- Ташкенту до «сейчас». Доли — как в мокапе: источники Instagram ≈ 49%, Telegram 23, Google 13,
-- прямые 10, Facebook 5; телефон 81%, компьютер 17, планшет 2; узбекский 63%; открыли ЖК ≈ 64%,
-- смотрели планировки ≈ 31%, телефон / Telegram ≈ 6%, заявка ≈ 2,3%.
-- DEMO: посетители — id «00000000-de30-…», визиты — «00000000-de31-…»; заявки — имя «DEMO · …»,
-- закрытые (сделка / отказ), без доставок — в Telegram и Таблицу не уходят. Удаляет remove.sql.
-- Запускается после seed.sql (scripts/demo.mjs): нужны опубликованные DEMO-ЖК.

select setseed(0.2026);

create temp table demo_stats_visitors as
with days as (
  -- ~150 посетителей в день: рост к сегодня, выходные тише.
  select d, ((now() at time zone 'Asia/Tashkent')::date + d) as day,
         greatest(40, round((120 + d * 0.9 + 45 * (extract(isodow from (now() at time zone 'Asia/Tashkent')::date + d) < 6)::int)
                            * (0.85 + random() * 0.3)))::int as n
  from generate_series(-59, 0) as d
),
complexes as (
  select array_agg(c.id order by c.slug) as ids
  from public.complexes c
  where c.slug like 'demo-%' and c.status = 'published'
),
raw as (
  select row_number() over (order by days.d, k) as n, days.day, k,
         random() as r_source, random() as r_device, random() as r_lang, random() as r_hour,
         random() as r_complex, random() as r_funnel, random() as r_layout, random() as r_contact,
         random() as r_lead, random() as r_visits, random() as r_views, random() as r_creative
  from days, generate_series(1, days.n) as k
)
select raw.n,
       ('00000000-de30-4000-8000-' || lpad(to_hex(raw.n), 12, '0'))::uuid as visitor_id,
       -- Час захода: больше вечером (мокап — пик после работы).
       ((raw.day::timestamp + make_interval(mins => (420 + floor(power(raw.r_hour, 0.8) * 960))::int))
         at time zone 'Asia/Tashkent') as at,
       case when raw.r_source < 0.49 then 'instagram' when raw.r_source < 0.72 then 't.me'
            when raw.r_source < 0.85 then 'google.com' when raw.r_source < 0.95 then null else 'facebook' end as source,
       raw.r_creative, raw.r_source, raw.r_lead,
       case when raw.r_device < 0.81 then 'mobile' when raw.r_device < 0.98 then 'desktop' else 'tablet' end as device,
       case when raw.r_lang < 0.63 then 'uz' else 'ru' end as lang,
       complexes.ids[1 + floor(power(raw.r_complex, 1.7) * array_length(complexes.ids, 1))::int] as complex_id,
       raw.r_funnel < 0.64 as sees_complex,
       raw.r_funnel < 0.64 and raw.r_layout < 0.48 as sees_layouts,
       raw.r_contact < 0.061 as contacts,
       raw.r_lead < 0.023 as leads,
       raw.r_contact < 0.025 as by_phone,
       case when raw.r_visits < 0.72 then 1 when raw.r_visits < 0.93 then 2 else 3 end as visits,
       2 + floor(raw.r_views * 5)::int as views
from raw, complexes;

-- Креатив — у части заходов с рекламы (utm_content, мокап «Рекламные креативы · UTM»).
alter table demo_stats_visitors add column medium text, add column content text;
update demo_stats_visitors v set
  medium = c.medium, content = c.content, source = coalesce(c.source, v.source)
from (values
  (0.00, 0.14, 'instagram', 'reels', 'shodlik_reels_03'),
  (0.14, 0.22, 'instagram', 'stories', 'namuna_story_12'),
  (0.22, 0.30, 'instagram', 'carousel', 'yulduz_carousel_02'),
  (0.30, 0.34, 'instagram', 'stories', 'orzu_story_05'),
  (0.49, 0.58, 't.me', 'post', 'tg_post_0928'),
  (0.95, 0.99, 'facebook', 'feed', 'sifat_feed_01')
) as c (r_from, r_to, source, medium, content)
where v.r_source >= c.r_from and v.r_source < c.r_to and v.r_creative < 0.85;

insert into public.events (visitor_id, session_id, type, path, entity_type, entity_id, source, medium, content, device, lang, at)
select v.visitor_id,
       ('00000000-de31-4000-8000-' || lpad(to_hex(v.n * 4 + s.visit), 12, '0'))::uuid,
       e.type, e.path, e.entity_type, e.entity_id, v.source, v.medium, v.content, v.device, v.lang,
       v.at + make_interval(hours => (s.visit - 1) * 3, mins => e.minute)
from demo_stats_visitors v
cross join lateral generate_series(1, v.visits) as s (visit)
cross join lateral (
  select 'page_view' as type, '/' || v.lang as path, null::text as entity_type, null::uuid as entity_id, k * 2 as minute
  from generate_series(0, v.views - 1) as k
  union all
  select 'complex_view', null, 'complex', v.complex_id, 1 where s.visit = 1 and v.sees_complex
  union all
  select 'layout_view', null, 'complex', v.complex_id, 3 where s.visit = 1 and v.sees_layouts
  union all
  select case when v.by_phone then 'phone_click' else 'telegram_click' end, null, 'complex', v.complex_id, 5
  where s.visit = 1 and v.contacts
  union all
  select 'lead_sent', null, 'complex', v.complex_id, 7 where s.visit = 1 and v.leads
) as e
where v.at + make_interval(hours => (s.visit - 1) * 3, mins => e.minute) <= now();

insert into public.leads (type, name, phone, contact_lang, site_lang, developer_id, complex_id, subject, page_url, source, status, created_at, updated_at)
select t.type, 'DEMO · Клиент ' || v.n, '+99890' || lpad((v.n % 10000000)::text, 7, '0'), v.lang, v.lang,
       c.developer_id, case when t.with_complex then c.id end,
       case when t.with_complex then jsonb_build_object('complex', c.name, 'slug', c.slug) else '{}'::jsonb end,
       case when t.with_complex then 'https://vodiyhouse.uz/' || v.lang || '/novostroyki/' || c.slug end,
       case when v.content is not null then jsonb_build_object('utm_source', v.source, 'utm_medium', v.medium, 'utm_content', v.content)
            when v.source is not null then jsonb_build_object('referrer', v.source) else '{}'::jsonb end,
       case when v.n % 4 = 0 then 'deal' else 'lost' end::public.lead_status,
       v.at + interval '7 minutes', v.at + interval '7 minutes'
from demo_stats_visitors v
join public.complexes c on c.id = v.complex_id
cross join lateral (
  -- Типы заявок — доли мокапа: обратный звонок 36%, просмотр 19, расчёт 15, по ЖК 11, документы 7, подбор 5, консультация 4, бот 3.
  select x.type::public.lead_type as type, x.with_complex
  from (values
    (0.00, 0.36, 'callback', false), (0.36, 0.55, 'view', true), (0.55, 0.70, 'calc', true), (0.70, 0.81, 'complex', true),
    (0.81, 0.88, 'documents', true), (0.88, 0.93, 'pick', false), (0.93, 0.97, 'consult', false), (0.97, 1.01, 'tg', false)
  ) as x (r_from, r_to, type, with_complex)
  -- r_lead < 0,023 у заявивших: r_lead / 0,023 — равномерно от 0 до 1.
  where v.r_lead / 0.023 >= x.r_from and v.r_lead / 0.023 < x.r_to
) as t
where v.leads and v.at + interval '7 minutes' <= now();

drop table demo_stats_visitors;
