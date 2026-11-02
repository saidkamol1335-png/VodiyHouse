# PROGRESS.md — vodiyhouse.uz · Проект-2 (сайт и админка раздельно)

Чекпоинт по CLAUDE.md (≤ 10 КБ). После шага — одна строка в журнал. Проект-1 закрыт 02.11.2026: итог, «TODO-заказчик» и «TODO-исполнитель» — `docs/progress/project-1-final.md` (там же открытые вопросы по материалам ЖК; они в силе).

## Сейчас

- **02.11 — интервью перед фазой 0/A проведено:** аудит `docs/split-audit.md`, решения — `PLAN.md` §10 (исполнитель принял все рекомендации). `CLAUDE.md` переписан под Проект-2.
- **Фаза A — монорепо и каркас** — готова локально 02.11 (журнал ниже). Не запушена: сначала перенастроить тестовый Netlify (раздел «Облако и деплой»). Дальше — интервью перед фазой B (схема и доступ).

## Фаза A — план
1. Сайт целиком (как есть, вместе с `/admin`) → `apps/site`; всё работает как раньше. Кабинет уходит из сайта в фазе C, когда админка его заменит.
2. `packages/shared` (`@vh/shared`): calc, format, units, quarters, i18n/locales — импорты сайта переведены.
3. `apps/admin` — каркас: светлая тема, вход-заглушка, noindex + `robots: Disallow`, security-headers и CSP, `netlify.toml`, `.env.example`.
4. Корень: npm workspaces, общие скрипты, `supabase/` в корне, два `netlify.toml` (base directory).
5. Приёмка: lint, typecheck, unit + db тесты, сборка обоих приложений, e2e smoke на 1440.

## Журнал фазы A
- A1 ✓ сайт целиком (вместе с /admin и /dev) → `apps/site` через git mv, история сохранена; пути к `supabase/` и `docs/` в скриптах и тестах — от корня репозитория.
- A2 ✓ `packages/shared` (`@vh/shared`): calc (с cabinet/discounts), format, units, quarters, locales, `styles/tokens.css` и `base.css`. Импорты сайта (362) → `@vh/shared/*`. Граф импортов тестов сайта ходит внутрь пакета: проверка «сайт не видит скидок» по-прежнему настоящая.
- A3 ✓ `apps/admin` (`@vh/admin`, порт 3001): светлая тема на общих токенах, экран входа-каркас, noindex (meta + X-Robots-Tag), robots Disallow, CSP без nonce + security-headers, запрет импорта кода сайта (ESLint), `netlify.toml`, `.env.example` с целевым списком env.
- A4 ✓ корень: npm workspaces, `dev:site`, `dev:admin`, `build:*`, `lint`, `typecheck`, `test`; `.gitignore` для build-папок в apps; `.claude/launch.json` — оба dev-сервера.
- A5 ✓ приёмка: lint (3 пакета) ✓, typecheck ✓, тесты: сайт 1548 (unit + db на PGlite), shared 205, admin 3 — все ✓; `build` сайта и админки ✓; e2e админки 390 + 1440 — 6/6 ✓; e2e сайта `pages.spec` на 1440 — 3/3 ✓. Снимки входа — `docs/design/project2-phase-a/`.

## Решения исполнителя по ходу (без вопросов, по CLAUDE.md)
- Сайт переезжает как есть, с кабинетом: до фазы C на тестовом деплое всё работает по-старому, кабинет убирается с сайта, когда админка его заменит.
- Общие стили подключаются относительным путём (`../../../packages/shared/styles/…`), не через exports пакета: так надёжно и в Tailwind, и в Turbopack.
- Тесты базы (`tests/db`) пока живут в `apps/site`; в фазе B — к `supabase/`.
- `npm run mockup:*` — в корне (мокап в `docs/`). e2e сайта: порт dev-сервера берётся из `E2E_PORT` (порт 3000 на ноутбуке занят Acer PredatorSense — e2e на 3002: `E2E_PORT=3002 npm run e2e:1440 -w @vh/site -- <спека>`).

## Полировка
- Старые артефакты в корне (`.next`, `out`, `coverage`, `test-results`, `tsconfig.tsbuildinfo`, `.env.local`) от сборок до переезда — в git их нет; удалить вручную, когда удобно. `.env.local` скопирован в `apps/site` и `apps/admin`.
- e2e сайта: в логе dev-сервера ECONNRESET «aborted» при закрытии страниц — тесты зелёные, шум.
- CSP админки — с `unsafe-inline`; script-src с nonce — в фазе D вместе с proxy кабинета.

## Облако и деплой — ждут «да» исполнителя
- Перенастроить тестовый сайт Netlify vodiyhouse-test: Package directory `apps/site` (base — корень) **до** пуша фазы A в origin, иначе сборка упадёт. Коммиты фазы A лежат локально, в origin не отправлены.
- Создать второй сайт Netlify для `apps/admin`.
