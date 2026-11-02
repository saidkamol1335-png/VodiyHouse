# Проект-2 · фаза A — монорепо и каркас (02.11.2026)

Перенесено из PROGRESS.md.

## Журнал
- A1 ✓ сайт целиком (вместе с /admin и /dev) → `apps/site` через git mv, история сохранена; пути к `supabase/` и `docs/` в скриптах и тестах — от корня репозитория.
- A2 ✓ `packages/shared` (`@vh/shared`): calc (с cabinet/discounts), format, units, quarters, locales, `styles/tokens.css` и `base.css`. Импорты сайта (362) → `@vh/shared/*`. Граф импортов тестов сайта ходит внутрь пакета: проверка «сайт не видит скидок» по-прежнему настоящая.
- A3 ✓ `apps/admin` (`@vh/admin`, порт 3001): светлая тема на общих токенах, экран входа-каркас, noindex (meta + X-Robots-Tag), robots Disallow, CSP без nonce + security-headers, запрет импорта кода сайта (ESLint), `netlify.toml`, `.env.example` с целевым списком env.
- A4 ✓ корень: npm workspaces, `dev:site`, `dev:admin`, `build:*`, `lint`, `typecheck`, `test`; `.gitignore` для build-папок в apps; `.claude/launch.json` — оба dev-сервера.
- A5 ✓ приёмка: lint (3 пакета) ✓, typecheck ✓, тесты: сайт 1548 (unit + db на PGlite), shared 205, admin 3 — все ✓; `build` сайта и админки ✓; e2e админки 390 + 1440 — 6/6 ✓; e2e сайта `pages.spec` на 1440 — 3/3 ✓. Снимки входа — `docs/design/project2-phase-a/`.

