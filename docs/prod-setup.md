# Прод на аккаунтах исполнителя (решение 02.11.2026)

Пока аккаунтов заказчика нет, боевой сайт живёт у исполнителя: отдельный проект Supabase и отдельный сайт Netlify. Код — ветка `release/project-1` (Проект-1: кабинет на `/admin`). Тестовое облако и vodiyhouse-test не трогаются: там DEMO для e2e.

Ключи и пароли вводит только человек — в дашборде и в файле `apps/site/.env.prod` (в git не попадает: `.env*`). Агент запускает команды с этим файлом и значений не видит.

## 1. Секреты (один раз, в своём терминале)

```bash
node -e "for (const n of ['SITE_SIGNING_SECRET','NEXT_SERVER_ACTIONS_ENCRYPTION_KEY','CRON_SECRET']) console.log(n + '=' + require('crypto').randomBytes(48).toString('base64url'))"
```

Три строки — в `.env.prod` (п. 3) и в Netlify (п. 4). В чат не присылать.

## 2. Supabase — новый проект (человек, ~10 мин)

1. Организация с тарифом **Pro** → New project: имя `vodiyhouse-prod`, регион **Central EU (Frankfurt)**, пароль базы — кнопкой Generate (сохранить у себя).
2. Project Settings → API Keys: создать новые `sb_publishable_…` и `sb_secret_…`.
3. Project Settings → JWT Keys: перейти на **асимметричные** ключи.
4. Authentication → Sign In / Providers → Email: включён; «Allow new users to sign up» — **выкл**; «Confirm email» — **выкл**; Anonymous sign-ins — **выкл**.
5. Authentication → Passwords: минимальная длина **10**; «Secure password change» — **выкл**; Leaked password protection — **вкл** (Pro).
6. Authentication → Rate Limits → **IP Address Forwarding — вкл**.
7. «Automatically expose new tables» — не включать. CAPTCHA — не включать (нет ключа Cloudflare; порядок — handover §2).
8. Connect → Session pooler — строка подключения (порт 5432) для `SUPABASE_DB_URL`.

## 3. Файл `apps/site/.env.prod` (человек)

В папке `Desktop\VH_release\apps\site\` создать `.env.prod`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
SUPABASE_SECRET_KEY=sb_secret_…
SUPABASE_DB_URL=postgresql://postgres.<ref>:<пароль>@<регион>.pooler.supabase.com:5432/postgres
SITE_SIGNING_SECRET=<из п. 1>
```

`E2E_SUPABASE_PROJECT_REF` сюда **не писать**: e2e не должны дотянуться до прода.

## 4. Netlify — новый сайт (человек, ~5 мин)

1. Add new site → Import an existing project → GitHub → репозиторий VodiyHouse.
2. Branch to deploy: **`release/project-1`**. Base directory — пусто; Package directory — `apps/site`; Build command — `npm run build -w @vh/site`; Publish directory — `apps/site/.next`. Имя сайта — например `vodiyhouse-prod`.
3. До первой сборки — Site configuration → Environment variables (все контексты):

| Переменная                             | Значение                                 |
| -------------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | как в `.env.prod`                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | как в `.env.prod`                        |
| `SUPABASE_SECRET_KEY`                  | как в `.env.prod`                        |
| `SITE_SIGNING_SECRET`                  | из п. 1 (тот же, что в `.env.prod`)      |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`   | из п. 1                                  |
| `CRON_SECRET`                          | из п. 1                                  |
| `SITE_NOINDEX`                         | `1` — до домена; на vodiyhouse.uz убрать |
| `NODE_VERSION`                         | `24`                                     |

Не задавать до ответа заказчика: `SITE_URL` (до домена — адрес Netlify), `TELEGRAM_*`, `LEADS_SHEET_*`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_YANDEX_MAPS_KEY`. Без Telegram и Таблицы заявка сохраняется в кабинете («Заявки») — это нормально до бота заказчика.

4. Если первая сборка уже запустилась без переменных — после них Deploys → «Clear cache and deploy site».

## 5. Дальше — агент (одно «да» исполнителя 02.11 на цепочку)

Из `Desktop\VH_release\apps\site`, все команды — с `--env-file=.env.prod`:

1. `node --env-file=.env.prod scripts/cloud-check.mjs --prod` — ключи и Auth.
2. `node --env-file=.env.prod scripts/db-push.mjs` — схема (74 миграции ветки).
3. `node --env-file=.env.prod scripts/vault-signing-secret.mjs` — секрет подписи в Vault.
4. `node --env-file=.env.prod scripts/realContent.mjs --drafts` — ЖК и застройщики из материалов **черновиками**, на сайте 0 опубликованных.
5. Netlify → «Clear cache and deploy site».
6. `cloud-check --prod` — «DEMO нет», сотрудников e2e нет, заявок нет, следующая — #1001.
7. Проверка «нет выдумок» (`docs/prod-check.md`) и Lighthouse.

`demo:seed` в прод не запускать никогда. Руководителя создаёт человек: `node --env-file=.env.prod scripts/staff-create-head.mjs --email … --name "…"` в своём терминале (временный пароль печатается).

## 6. Перенос к заказчику (без пересоздания)

- **Supabase**: заказчик создаёт организацию (лучше сразу Pro) и приглашает исполнителя Owner'ом → у исполнителя: Project Settings → General → **Transfer project** → организация заказчика. Ref, ключи, база, Storage и Vault не меняются; Netlify и `.env.prod` трогать не нужно. Pro и бэкапы — у организации заказчика.
- **Netlify**: заказчик создаёт команду и приглашает исполнителя → у исполнителя: Site configuration → General → **Transfer site** → команда заказчика. Переменные и деплои переезжают с сайтом; заказчику — переподключить GitHub (Build & deploy → Repository), если репозиторий тоже переезжает.
- После переноса: домен vodiyhouse.uz на Netlify заказчика → `SITE_URL=https://vodiyhouse.uz`, убрать `SITE_NOINDEX` → «Clear cache and deploy site». Исполнитель выходит из организации и команды; токен Netlify CLI — отозвать.
