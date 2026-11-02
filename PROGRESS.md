# PROGRESS.md — vodiyhouse.uz · Проект-2 (сайт и админка раздельно)

Чекпоинт по CLAUDE.md (≤ 10 КБ). После шага — одна строка в журнал. Проект-1 закрыт 02.11.2026: итог, «TODO-заказчик» и «TODO-исполнитель» — `docs/progress/project-1-final.md` (там же открытые вопросы по материалам ЖК; они в силе).

## Сейчас

- **02.11 — интервью перед фазой 0/A проведено:** аудит `docs/split-audit.md`, решения — `PLAN.md` §10 (исполнитель принял все рекомендации). `CLAUDE.md` переписан под Проект-2.
- **Фаза A — монорепо и каркас** — в работе.

## Фаза A — план
1. Сайт целиком (как есть, вместе с `/admin`) → `apps/site`; всё работает как раньше. Кабинет уходит из сайта в фазе C, когда админка его заменит.
2. `packages/shared` (`@vh/shared`): calc, format, units, quarters, i18n/locales — импорты сайта переведены.
3. `apps/admin` — каркас: светлая тема, вход-заглушка, noindex + `robots: Disallow`, security-headers и CSP, `netlify.toml`, `.env.example`.
4. Корень: npm workspaces, общие скрипты, `supabase/` в корне, два `netlify.toml` (base directory).
5. Приёмка: lint, typecheck, unit + db тесты, сборка обоих приложений, e2e smoke на 1440.

## Журнал фазы A

## Решения исполнителя по ходу (без вопросов, по CLAUDE.md)

## Полировка

## Облако и деплой — ждут «да» исполнителя
- Перенастроить тестовый сайт Netlify vodiyhouse-test на base directory `apps/site` **до** пуша фазы A в origin (иначе сборка упадёт).
- Создать второй сайт Netlify для `apps/admin`.
