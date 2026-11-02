# Проверка прода «нет вымышленных данных» (02.11.2026)

Две проверки, обе **только чтение**. Запускать из `Desktop\VH_release\apps\site`.

## 1. База — `cloud:check -- --prod`

```bash
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env.prod scripts/cloud-check.mjs --prod
```

✗ — DEMO (ЖК и застройщики `demo-…`, заявки «DEMO · …»), сотрудники `…@example.com`, опубликованный ЖК без минимума, запрос не прошёл, версии миграций в облаке, которых нет в ветке. ? — заявки (настоящие ли), следующий номер заявки, нет курса, нет руководителя.

## 2. Сайт — обход `playwright.prod.config.ts`

```bash
PROD_URL=https://<прод>.netlify.app PROD_ALLOWED_PHONES="+998…" PROD_ALLOWED_LINKS="t.me/<vh>,instagram.com/<vh>" npx playwright test -c playwright.prod.config.ts
```

(PowerShell: `$env:PROD_URL="…"; npx playwright test -c playwright.prod.config.ts`.) `PROD_ALLOWED_*` — контакты Vodiy House из «Настройки → Контакты»; пока их нет — не задавать: тогда на сайте не должно быть ни одного телефона и ссылки-контакта.

- **HTML** (1440, один проход): sitemap + 20 публичных страниц ru/uz — нет названий мокапа и DEMO (`lib/site/prodCheck/fiction.ts`), «DEMO», «TODO», «Lorem», `/demo-`, `example.com`, `e2e-`; нет телефонов и ссылок `tel:` / `t.me` / `wa.me` / Instagram, кроме контактов VH (правило 1.2).
- **Страницы** (390 и 1440): видимый текст без «0 ЖК», «Найдено 0», «0 жилых комплексов», «0 ta»; внутренние ссылки без 4xx/5xx; консоль без ошибок; снимки всех страниц — `test-results/prod/<тест>-<проект>/*.png`.

Ничего не пишет: global-setup нет (сотрудников не создаёт); браузер — с cookie сессии, поэтому события не отправляются (`lib/events/client.ts`); `sendBeacon` — заглушка; Service Worker запрещён; всё, кроме GET и HEAD, обрывается, а дошедший до сервера не-GET роняет тест. Если всё же что-то записалось (заявка, событие, сотрудник) — удалить с «да» исполнителя и вернуть счётчик заявок к #1001.
