# Аудит перед разделением: сайт vodiyhouse.uz / админка admin.vodiyhouse.uz

Дата: 02.11.2026 · репо `Desktop\VH_mijoz` (main, fe17320) · только чтение, код не менялся.

## 1. Маршруты и модули

| Что | Сейчас | Решение | Примечание |
|---|---|---|---|
| `app/admin/vhod`, `parol` | вход + Turnstile, смена пароля | → админка | + 2FA руководителя через Telegram |
| `app/admin/(cabinet)` главная | заявки, «Сейчас на сайте», остатки | → админка | |
| `zayavki/*`, `zayavki/csv` | заявки, CSV | → админка | |
| `zhk/*` (11 вкладок, мастер) | ЖК: основное, блоки, планировки, квартиры, фото, фасад, видео, детали, документы, предпросмотр, журнал | → админка, экраны 2–5 по новой структуре | предпросмотр — новая вкладка с токеном вместо iframe |
| `zastroyshchiki/*` | застройщики, `developer_private`, журнал | → админка | |
| `vitrina/*` | спецпредложения, подборки, реклама | → админка | |
| `programmy/*`, `raschet` | программы оплаты, расчёт для клиента со скидкой | → админка | скидки живут только здесь |
| `statistika/*` | статистика, CSV | → админка | |
| `nastroyki/*` | сотрудники, справочники, контакты, журнал | → админка | |
| `video` | видеограф: отчёты, проверка | → админка, кабинет мобилографа (фаза E) | роль `videographer` → `mobilographer` |
| `app/api/cron/[job]` + `netlify/functions/cron.mts` | leads, tg-starts, archive, events, showcase, progress, rate (не по расписанию) | → админка | `expireShowcaseNow`/`expireRateNow` → вебхук revalidate сайта |
| `app/api/telegram` + `lib/leads/server/{bot,telegram}` | вебхук бота | → админка | перерегистрация вебхука на новый домен |
| `app/api/predprosmotr*` | draftMode по cookie сессии head | удаляется | на сайте — `/preview/zhk/{slug}?token=` (HMAC, 15 мин, noindex) |
| `lib/archive/server/purge` | удаление архива, CSV в Telegram | → админка | |
| `lib/stats`, `lib/captcha`, `geo`, `slug`, `translit` | только кабинет | → админка | |
| `lib/admin/**` (actions, auth, complexes, units, …) | кабинет | → админка | `*/demo*`, `dictionaries/seed` — только для `/dev` |
| `app/[locale]/**` (публичные страницы) | сайт | остаётся на сайте | |
| `lib/site/**`, `lib/og`, `lib/showcase` (чтение) | сайт | остаётся на сайте | кабинет тоже использует `lib/site/*` — общие части → `packages/shared` |
| `lib/calc`, `lib/format`, `lib/units`, `lib/i18n`, `lib/rates`, `lib/quarters`, `lib/routes` | общие | → `packages/shared` | |
| `lib/leads/actions` + `server/submit` (заявка) | server action, **service key** | сайт, без service key | rpc для anon + подпись секретом сайта |
| `lib/leads/server/deliver` (Telegram/Таблица) | `after()` в сайте | → админка (Database Webhook на insert) | |
| `lib/leads/telegramActions` (кнопка «Написать в Telegram») | **service key** | сайт, без service key | тот же подход, что у заявок |
| `app/api/e` + `lib/events/server/track` | события статистики, **service key** | сайт, без service key | `hasAuthCookie` сотрудника на сайте больше не виден |
| `lib/events/server/online` (счётчик онлайн) | **service key**, без кэша | удаляется с сайта | |
| `readComplexUnitsAction` → `block_units` | живой статус квартир без кэша | сайт, через кэш + revalidate | см. вопрос 4 |
| `proxy.ts` | `/admin` гейт + локаль, рекламная cookie, сессия для превью | сайт: только локаль и рекламная cookie; админка: гейт по ролям | |
| `components/*` | 119 только кабинет · 89 только сайт · 23 общих · 5 только `/dev` | по группам; общие (Button, Field, Calc*, PaymentCalculator, Logo, …) → `packages/shared/ui` | |
| `app/dev/**` | стенды на DEMO; 29 из 65 e2e-спек ходят в `/dev` | стенды кабинета → админка, стенды сайта → сайт | CLAUDE.md запрещает новые стенды; старые переносим |
| `messages/{ru,uz}.json` | общий, ключ `admin` | `admin` → админка (только ru), остальное — сайт | |
| `supabase/migrations` (66) | одна схема | → корень `supabase/`, единственный источник | |
| `tests/db` (pglite, 45 файлов) | доступ, публикация, заявки… | → `supabase/tests` или `packages/shared` | `access-matrix.test.ts` — основа тестов доступа |

## 2. Что уже есть в базе (важно для фазы B)

- Публичное чтение сейчас — **SECURITY DEFINER-функции `site_*`** (`site_catalog`, `site_complex`, `site_layout_calc`, …), а не views. Скидки и неполные планировки они уже вырезают. Прямой SELECT у anon остался на `developers`, `complexes`, `blocks`, `complex_documents/videos/details`, `deadline_changes`, `floor_plans`, справочниках, публичных `settings`.
- Состояние ЖК (черновик / скоро / полный) **считается функциями при чтении** (`complex_requirements`, `complex_site_view`), не хранится. Стражи-триггеры уже не дают ухудшить опубликованный ЖК.
- pg_cron не используется — расписание через Netlify Scheduled Functions.
- Таблиц себестоимости нет; скидки — только `payment_programs.discount_pct` и `tiers[].discount_pct`.
- Storage `media` и `progress-video` — public по прямой ссылке.

## 3. Вопросы интервью и ответы

Решения — `PLAN.md` §10.
