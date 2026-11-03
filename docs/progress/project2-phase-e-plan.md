# Проект-2 · фаза E — кабинет мобилографа (план, 03.11.2026, ред. 2 после двух критиков)

Решения — `PLAN.md` §10, пп. 10, 13, 31–38. Наследство — Проект-1, фаза 5 (`docs/progress/phase-5.md`). Конвенции журнала — `docs/progress/project2-phase-d.md`.

**Правила фазы 5, которые остаются:** блок у отчёта есть всегда («отчёт по ЖК» = отчёт по блоку); квартира необязательна, проданная — нельзя (`vh:sold`), снимок квартиры (планировка, комнаты, площадь, этаж) переживает её удаление; «один отчёт на блок за месяц», по квартире — сколько угодно; «На проверку» — 3–15 фото, комментарий RU и UZ ≤ 300; YouTube и файл вместе нельзя; видео только MP4 (`.mov` — подсказка про YouTube); чужие файлы и файлы галереи в отчёт не берутся; публикует и возвращает только руководитель (`20261102170000`), публикация — только с отметкой 1.2 (`vh:rule12`); опубликованный отчёт не правится, снять — руководитель (снова проверка); файлы удаляет сервер секретным ключом; страница видео квартиры — без номера, `unit_id`, цены; напоминание 45 дней — как было.

**Порядок (CLAUDE.md: одна сессия, последовательно, агенты — только чтение):** блок 1 — P0 | блок 2 — P1 → P3 | блок 3 — P2 → P4 → P5 | E7 приёмка. Конец каждого блока: e2e блока на 1440, ревью одним агентом в один круг, «Сейчас» в `PROGRESS.md`, коммит «проект-2, фаза E: …». После каждого шага — строка в `PROGRESS.md`. Владение файлами в §6 не пересекается — параллельно пакеты можно вести только с явного разрешения пользователя. Облако и Netlify — исполнитель сам (п. 38).

---

## 1. Схема базы

Все функции — `security definer`, `set search_path = ''`, ошибки `raise … using hint = 'vh:<code>'`. Новые функции: `revoke all … from public, anon` и явный `grant` (по умолчанию закрыто, `20261029070000:144-145`). Значение `'draft'` уже есть в `progress_status` (`20261102100000_project2_roles.sql:28`, прошлая фаза); харнесс PGlite выполняет каждую миграцию отдельным `exec` (`harness.ts:80-89`) — `ALTER TYPE` в фазе E не нужен.

### E1.1 `20261103140000_progress_shot_on.sql` — колонки, ограничения, права
1. **Дата съёмки.** `add column shot_on date`. Перенос: `alter table … disable trigger progress_reports_set_updated_at` + `set_config('vodiy.skip_audit','on',true)` → `shot_on = greatest(month, least((created_at at time zone 'Asia/Tashkent')::date, (month + interval '1 month' - interval '1 day')::date))` → `'off'`, `enable trigger`. Затем `set not null`, `progress_reports_month_of_shot check (month = date_trunc('month', shot_on)::date)`. `month` — обычная колонка (индексы, `site_*`, матрица, напоминание), ставят её только функции из `shot_on`.
2. **Комментарий.** `alter column comment type jsonb using comment::jsonb` (домен `i18n_text` требует оба языка, `20261019160000:17-31`). Проверки `length ≤ 300` остаются. `progress_reports_comment_shape check (jsonb_typeof(comment)='object' and comment - 'ru' - 'uz' = '{}' and jsonb_typeof(comment->'ru')='string' and jsonb_typeof(comment->'uz')='string' and (status in ('draft','returned') or (btrim(comment->>'ru') <> '' and btrim(comment->>'uz') <> '')))`. Оба языка обязательны с «На проверку» — это проверяет функция.
3. **Пути.** `drop constraint progress_photos_path_check`, `drop constraint progress_reports_video_path_check` (имена — по правилу Postgres для безымянных проверок колонки). Новые:
   - фото `progress_photos_path_ok check ((path ~ '^complexes/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$') and split_part(path,'/',2) = complex_id::text)` — у incoming (`<автор>/<ЖК>/<uuid>`) второй сегмент тоже ЖК;
   - видео `progress_reports_video_path_ok` — то же с `\.mp4$`; табличная `check (video_path is null or split_part(video_path,'/',2) = complex_id::text)` (`20261029100000:42`) остаётся;
   - **адрес публикации**, назначает только база: `progress_photos.publish_path text unique check (publish_path ~ '^complexes/…\.jpg$' and split_part(publish_path,'/',2)=complex_id::text)`, `progress_reports.video_publish_path text unique` (то же, `.mp4`);
   - `progress_reports_published_public check (status <> 'published' or ((video_path is null or video_path like 'complexes/%') and video_publish_path is null))`. Фото опубликованного — инвариант «нет incoming» держит `publish_progress_report` (проверка перед сменой статуса) и DB-тест; триггеров нет (пишут пути только definer-функции).
4. **Уникальность.** `drop index progress_reports_block_month; create unique index … (block_id, month) where not is_unit and status <> 'draft'` — черновики разных мобилографов не мешают; дубль ловит «На проверку» (`vh:duplicate`); возвращённый место держит.
5. **RLS «черновик видит только автор» (п. 32).** select `progress_reports`: `using ((status <> 'draft' and private.has_role('head','manager')) or (author_id = (select auth.uid()) and private.has_role('head','mobilographer')))`. `progress_photos` (через `exists` по отчётам) — без изменений. Записи — только RPC.
6. **Хранилище (п. 13, 31).**
   - Удалить `media: видеограф загружает фото отчётов` (`20261029110000:35-42`) и `progress-video: загружают видеограф и руководитель` (`:48`) — в публичные бакеты пишет только сервер секретным ключом.
   - `update storage.buckets set file_size_limit = 52428800 where id in ('incoming','progress-video')` — 50 МБ на бакете; на Pro поднимается правкой бакета в панели, без кода.
   - `private.incoming_ref(name text) returns public.progress_status` (stable, definer, grant authenticated): статус отчёта, чей `progress_photos.path` или `video_path` = `name`, иначе `null`.
   - Политики `incoming` заменить: insert — как было и `private.incoming_ref(name) is null`; select — только своя папка (`split_part(name,'/',1) = auth.uid()`, роли `head|mobilographer`); delete — своя папка и `coalesce(private.incoming_ref(name) in ('draft','returned'), true)` (файл отчёта на проверке не удалить и не подменить; update-политики нет → upsert невозможен). Менеджер — ничего. Чужие incoming (ящик проверки, правка возвращённого руководителем) — только подписанные сервером адреса.
   - Путь: `incoming/<uid автора>/<id ЖК>/<uuid>.(jpg|mp4)` (`private.is_incoming_path`, `20261102140000:161`).

### E1.2 `20261103150000_progress_mobile_rpc.sql` — функции
Помощники (`private`, без grant):
- `progress_shot_ok(p_shot date, p_old date) returns boolean`: `p_shot = p_old or p_shot between private.tashkent_today() - 60 and private.tashkent_today()`. `p_old` передаётся **только для `returned`** (как месяц в фазе 5); черновик и новый — полное окно.
- `progress_file_ok(p_path text, p_complex uuid, p_report uuid, p_ext text) returns boolean`: путь уже в этом отчёте (`progress_photos.report_id = p_report` или его `video_path`) → `true`, кто бы ни загрузил. Иначе только incoming: 1-й сегмент `auth.uid()`, 2-й — `p_complex`; объект есть в `storage.objects (bucket_id='incoming')`, `created_at > now() - interval '24 hours'`, `metadata->>'mimetype'` = `image/jpeg` для `.jpg` / `video/mp4` для `.mp4`, `(metadata->>'size')::bigint` ≤ 15728640 (`.jpg`) / ≤ 52428800 (`.mp4`); не в другом отчёте. Публичный путь, не принадлежащий отчёту, — `false` (галерея, чужие).
- `progress_notice(r public.progress_reports) returns jsonb` → `{complex (ru), block, unit (number|null), shot_on, author (full_name|null)}`.

Публичные (`grant execute … to authenticated`, если не сказано иное):
1. **`save_progress_draft(p_report jsonb) returns jsonb`** → `{id, complex_id, status, removed:[paths]}`. Роль `head|mobilographer` (`vh:forbidden`). Вход `{id?, block_id, unit_id?, shot_on, comment{ru,uz}, youtube_id?, video_path?, photos[{path,width,height,blur?}]}`.
   - Новый: `status='draft'`, `author_id=auth.uid()`; не больше 30 черновиков автора (`vh:limit`). С `id`: строка `for update`; `draft` — только автор (иначе `vh:not_found`); `returned` — автор или руководитель, статус и причина остаются; иначе `vh:stale`; ЖК не меняется (`vh:invalid`).
   - Проверки: ЖК не архив (`vh:archived`), блок, квартира блока и не продана, `progress_shot_ok` (`vh:shot_date`), 0–15 фото (`vh:photos`), `progress_file_ok` (`vh:invalid`), YouTube (`vh:youtube`), YouTube + файл (`vh:invalid`), строки ≤ 300 (`vh:comment`). Дубль не проверяется. Фото переписываются `sort` 1..n.
   - Журнал: запись строки `draft` — `skip_audit 'on'` и сразу `'off'` после оператора; `returned` — с журналом. `removed` — убранные из отчёта пути.
2. **`submit_progress_report(p_report jsonb) returns jsonb`** (`create or replace`) → `{id, complex_id, removed, notice}`. `month` во входе игнорируется. С `id`: `draft` (только автор) или `returned` (автор или руководитель), иначе `vh:stale`. Полная проверка фазы 5 (3–15 фото, оба языка) + `vh:shot_date` + `progress_file_ok` + `vh:duplicate` по `status <> 'draft'` и `id <> self` + не больше 30 отчётов автора в `review` (`vh:limit`). Из черновика — обычный `update … set status='review', created_at=now()` (журнал: одна запись `update`, «Черновик → На проверке»; очередь «Ждут проверки» и «Снял … · {at}» — по моменту отправки). Из `returned` — update, как сейчас.
3. **`delete_progress_report(p_id uuid) returns jsonb`** (`create or replace`) → `{complex_id, removed}`. Автор — только `draft`, `returned` (`vh:forbidden`); руководитель — любой. `skip_audit` — только для `draft`; `returned` в журнал пишется. `removed` включает `publish_path`/`video_publish_path`.
4. **`progress_publish_files(p_id uuid, p_checked boolean) returns jsonb`** → `{version, files:[{from, to, bucket:'media'|'progress-video'}]}`. Проверки как у публикации до копирования: `head` (`vh:forbidden`), `review` (`vh:stale`), архив (`vh:archived`), `p_checked` (`vh:rule12`). Строка `for update`; каждому incoming-файлу без адреса публикации база назначает `publish_path = 'complexes/<ЖК>/' || gen_random_uuid() || '.jpg'` (видео — `video_publish_path`, `.mp4`). `version` = `updated_at`.
5. **`publish_progress_report(p_id uuid, p_checked boolean default false, p_version timestamptz default null) returns jsonb`** (старая перегрузка `drop`, одна новая) → `{id, complex_id, author_id, is_unit, slug, incoming:[старые пути], notice}`. Проверки + `updated_at = p_version` (иначе, в т. ч. `null`, — `vh:stale`) + у каждого incoming есть адрес публикации и объект в `media`/`progress-video` (`vh:files`). Одна транзакция: `path = publish_path, publish_path = null` (видео так же), проверка «нет incoming» (`vh:files`), `status='published'`.
6. **`return_progress_report(p_id uuid, p_note text)`** (`create or replace`) → + `author_id`, `notice`, `removed` (назначенные `publish_path`, обнуляются — возможные копии удалит сервер).
7. **`remove_progress_photo(p_photo uuid) returns jsonb`** → `{report_id, complex_id, removed:[path, publish_path?]}` («Убрать кадр», п. 38). Только руководитель; отчёт `for update`, статус `review` (`vh:stale`); после удаления ≥ 3 (`vh:frames`). `sort` не перенумеровывается (дыры безвредны: читатели сортируют по `sort`, следующее сохранение пишет 1..n). `updated_at = now()` (публикация со старой версией ящика → `vh:stale`). Журнал — ручная строка `audit_log (actor_id = auth.uid(), action 'update', entity 'progress_reports', entity_id, complex_id, developer_id (застройщик ЖК), changes {"photos":[4,3]})`.
8. `unpublish_progress_report` — без изменений (пути публичные; повторной публикации копировать нечего).
9. **Сайт (п. 33).** `private.site_progress_report(r)` — `'shot_at', r.shot_on`. `site_unit_video` (`20261101120000:580-610`) — **оба** порядка (внешний `history` и внутренний `limit 6`, `:603`) → `month desc, shot_on desc, created_at desc`. `site_complex_progress` — без изменений. `progress_overview()` — доступ `private.has_role('head','manager')` (было `is_staff`, `20261029140000:14`), `videos.shot_at = r.shot_on`.
10. **`progress_tasks() returns jsonb`** (п. 34). Только `mobilographer`, иначе `null`. Месяц — `date_trunc('month', private.tashkent_today())::date`. ЖК: `status <> 'archived'` и есть блок `build_status = 'building'`. Ответ `{month, today, total, left, complexes:[{id, name (ru), total, left, blocks:[{id, name, status:'none'|'draft'|'review'|'returned'|'published', report_id, mine, shot_on}]}]}`. Статус блока: не-черновик за месяц (он один), иначе свой черновик, иначе `none`. `report_id` — только у своего. `left` = блоки без `review`/`published`. ЖК по имени, блоки `sort, name`.
11. **`progress_media_complexes() returns jsonb`** (п. 35) → `[{id, name, address (ru), lat, lng, building, reports, last_month}]`; **`progress_media(p_complex uuid)`** → `{id, name, address, landmark, lat, lng, months:[{month, reports:[{id, is_unit, block, shot_on, youtube_id, video_path, photos:[{path,width,height}]}]}]}` — только `published`, 24 месяца. Доступ `private.is_staff()`, иначе `null`; ЖК не архив. Без `developer_*`, цен, номеров квартир, причин возврата.
12. **`progress_incoming_orphans(p_limit integer default 500) returns jsonb`** (только `service_role`) → `[name]`: `bucket_id='incoming'`, имя по регэкспу incoming, `created_at < now() - 48 h`, без ссылок `path`/`video_path`.
13. **`progress_public_refs(p_paths text[]) returns text[]`** (только `service_role`) — какие из путей упомянуты в `path`, `video_path`, `publish_path`, `video_publish_path`, `media_assets.path`.

### E1.3 `20261103160000_staff_telegram_mobile.sql` — Telegram мобилографа (п. 36)
- `private.staff_telegram_links` + `kind text not null default 'head' check (kind in ('head','mobile'))`.
- `create_staff_telegram_link(p_user, p_token_hash)` (сигнатура та же, `create or replace`): `kind` из `profiles.role` (`head`→`head`, `mobilographer`→`mobile`), иная роль → `false`. `complete_staff_telegram_link` — `null`, если роль больше не совпадает с `kind`. `staff_telegram_chat` — как есть.
- **`unlink_staff_telegram(p_user uuid) returns boolean`** (`service_role`): не `mobilographer` → `vh:forbidden` (руководитель — только сбросом разработчика, п. 28); удаляет привязку и ссылки.
- Триггер `profiles_role_unlink_telegram` (after update of `role`, `old.role is distinct from new.role`): удалить `staff_telegram`, `staff_telegram_links`; если `old.role = 'head'` — ещё `head_totp`, `head_codes`, `head_backup_codes` (`20261103110000:61-78`).

### E1.4 Существующие данные
- Старые отчёты сохраняют `complexes/…`; правка возвращённого старого оставляет их (путь уже в отчёте), новые кадры — из `incoming`.
- `shot_on` — перенос §E1.1.1 (без сдвига `updated_at`); DEMO `apps/admin/scripts/demoProgress.mjs:119`, `realContent.mjs:488` пишут `shot_on`.
- Черновиков нет.

**Деплой:** после `db:push` блока 1 и до деплоя E7 раздел видео тестового кабинета не работает (старая форма грузит в `media` и шлёт публичные пути); `video-reporter.spec` и старые e2e видео против облака в это время не гоняются; сайт работает.

**Готово E1:** три миграции на PGlite и `db:push`; DB-тесты §5 зелёные локально и `test:db:remote`; второй агент по миграциям и правам — один раз.

---

## 2. Сервер и действия

Действия — `"use server"`, первая строка — `const guard = await requireActionViewer(…)`; белый список `lib/admin/actions/guards.test.ts` (c); всё с секретным ключом — `{ fresh: true }` (d).

| Файл | Действие | Охрана | Что делает |
|---|---|---|---|
| `actions/progressReports.ts` | `readProgressUnitsAction(blockId)` | `["head", "mobilographer"]` | как сейчас |
| | `saveProgressDraftAction(formData)` | `["head", "mobilographer"], { fresh: true }` | `rpc("save_progress_draft")` → `removeProgressFiles(removed)` → `{status:"saved", id}` |
| | `submitProgressReportAction(formData)` | `["head", "mobilographer"], { fresh: true }` | `bilingualHasContact(comment)` → `contacts`; `rpc("submit_progress_report",{p_report:{id, block_id, unit_id, shot_on, comment, photos, youtube_id, video_path}})` → удалить `removed` → `notifyHeadSubmitted(notice, id)` → `{status:"done", id, notified}` |
| | `deleteProgressDraftAction(formData)` | `["head", "mobilographer"], { fresh: true }` | `rpc("delete_progress_report")` → удалить `removed` |
| `actions/progressReview.ts` | `publishProgressReportAction(formData)` | `["head"], { fresh: true }` | `publishProgress(supabase, id, checked, version)` |
| | `returnProgressReportAction(formData)` | `["head"], { fresh: true }` | rpc → удалить `removed` → `notifyAuthor(author_id, returnedText)` |
| | `removeProgressPhotoAction(formData)` | `["head"], { fresh: true }` | `rpc("remove_progress_photo")` → удалить `removed` |
| `actions/progressTelegram.ts` (новый) | `progressTelegramLinkAction()` | `["mobilographer"], { fresh: true }` | `telegramLink(viewer.id)` (`server/secondFactor.ts:63`, как есть: формат `h_<токен>`, вид привязки определяет база по роли) |
| | `progressTelegramUnlinkAction()` | `["mobilographer"], { fresh: true }` | `rpc("unlink_staff_telegram",{p_user: viewer.id})` секретным ключом |

`readVideo` в `progressReports.ts` принимает только `INCOMING_PATH_PATTERN` или путь, уже бывший в отчёте; форма получает `viewer.id` для `incomingPath`.

**Публикация** `lib/admin/server/progressPublish.ts` `publishProgress(supabase, id, checked, version)`:
1. `bilingualHasContact(comment)` → `contacts` (до копий). `rpc("progress_publish_files",{p_id, p_checked})` клиентом руководителя; её `version` ≠ `version` ящика → `stale`.
2. Каждую пару: `from` ~ `INCOMING_PATH_PATTERN`, `to` ~ публичный шаблон, ЖК `from`/`to` равны → иначе отказ. Секретным ключом `storage.from("incoming").copy(from, to, { destinationBucket })`. 409 — успех (адрес назначен базой, значит, это наш прошлый повтор); в «созданные» идут только 200.
3. `rpc("publish_progress_report",{p_id, p_checked, p_version: version})` клиентом руководителя.
4. Сбой шагов 2–3 (любой код): `rpc("progress_public_refs", созданные)` секретным ключом → удалить созданные без ссылок. Код → `admin.developers.errors`.
5. Успех: удалить `incoming` (сбой — лог, подберёт уборка), `expireProgress(id, complex_id)`, `notifyAuthor(author_id, publishedText)` со ссылкой — новая экспортируемая `clientVideoUrl({isUnit, id, slug})` в `server/progressOverview.ts`, приватная `clientUrl` (`:38-42`) переписывается на неё.

**Удаление файлов** `lib/admin/server/mediaFiles.ts` `removeProgressFiles(admin, paths)`: явные шаблоны — `INCOMING_PATH_PATTERN` → `incoming`, `^complexes/<uuid>/<uuid>\.jpg$` → `media`, `PROGRESS_VIDEO_PATH_PATTERN` → `progress-video`; прочее — лог и пропуск.

**Подписанные адреса** `lib/admin/server/progressFiles.ts` `signProgressFiles(paths)`: публичные — `mediaPublicUrl`/`progressVideoPublicUrl`; incoming — секретным ключом на 1 ч; пути только из строк, прочитанных клиентом пользователя по RLS. Используют `readReportDetail`, `readReviewQueue` (`thumbUrl`), `readAuthorProgressReports` (`thumbUrl`), `readProgressReportForEdit` (превью формы, в т. ч. файлы руководителя в возвращённом).

**Уведомления (п. 36).** `lib/admin/progress/notify.ts` — `progressSubmittedText(notice, url)`, `progressReturnedText(notice, note, url)`, `progressPublishedText(notice, url)`. `lib/admin/server/progressNotify.ts`: `notifyHeadSubmitted(notice, id)` → `sendTelegram(config, config.alertChatId, …)`, ссылка `adminOrigin() + "/video?report=<id>"`; `notifyAuthor(authorId, text)` → `staff_telegram_chat` секретным ключом → личный чат; не привязан / нет `telegramConfig()` — `false`; сбой не роняет действие; автор = руководитель — не пишем. Поток уведомлений ограничен базой (≤ 30 отчётов автора на проверке).

**Бот** `lib/leads/server/bot.ts` `linkStaff`: после `complete_staff_telegram_link` читает `profiles.role` секретным клиентом; `mobilographer` → ответ «Уведомления об отчётах будут приходить сюда», без `alertStaffLinked`; иначе — как сейчас. `LINK_TOKEN`, `codes.ts`, `secondFactor.ts` не меняются.

**Расписание:** `lib/admin/server/incomingSweep.ts` `sweepIncoming(admin): Promise<number>` — `progress_incoming_orphans` → повторная проверка имени `INCOMING_PATH_PATTERN` → `remove` пачками по 100; `CRON_JOBS.incoming` (`lib/leads/server/jobs.ts`); `netlify/functions/cron.mts` — `getUTCHours() === 21` (02:00 Ташкент).

**Архив:** `lib/archive/server/purge.ts` `clearIncoming(admin, complexId)`: папки-авторы `incoming` — `list("")` с пагинацией как `clearFolders` (`purge.ts:92-110`), затем `clearFolders(admin, "incoming", authors.map(a => \`${a}/${complexId}\`))`; в `removeFiles` и `removeComplexFiles`.

**Кэш:** `expireProgress` — публикация и удаление руководителем опубликованного; остальное публичного не меняет. Кабинет — `router.refresh()`.

---

## 3. Экраны

**Адреса** (`lib/admin/nav.ts` `ADMIN_ROUTES`): `video`, `videoNew: "/video/novyy"`, `videoMine: "/video/moi"`, `videoMedia: "/video/media"`. Пункт меню один — `video`. Доступ: `/video`, `/video/media` — все три роли; `/video/novyy`, `/video/moi` — `head`, `mobilographer` (менеджеру `AdminDenied`). `/video?fix=<id>` → редирект `/video/novyy?id=<id>`.

**`app/(admin)/(cabinet)/video/layout.tsx`**: `requireSection("video")` → `<VideoLayout role>`: `AdminPage topbar` с заголовком по роли (`video.titleMobilographer` / `video.title`), `AdminTabs className="video-layout__tabs"` (мобилограф: «Задания · Новый отчёт · Мои отчёты · Медиа ЖК»; руководитель: «Проверка · Новый отчёт · Мои отчёты · Медиа ЖК»; менеджер: «Проверка · Медиа ЖК»), `children`, у мобилографа `<VideoDock/>` и модификатор `video-layout--dock` (≤ 760 px: `.video-layout--dock .video-layout__tabs {display:none}`, `padding-bottom` под панель — свои элементы блока).

| Адрес | Мобилограф | Руководитель / менеджер |
|---|---|---|
| `/video` | `ProgressTasks`: «Осталось N из M · {месяц}», ЖК → блоки со значком; `none` — «Снять отчёт» (`/video/novyy?complex=&block=`), свой `draft` — «Продолжить», свой `returned` — «Исправить» (`?id=`) | `ReviewScreen` (как сейчас; ящик `?report=`) |
| `/video/novyy` | форма (`?id=` — черновик/возвращённый; `?complex=&block=`); справа «Как снимать» | руководитель — та же форма |
| `/video/moi` | `ProgressMine` (только `author_id = viewer.id`): `Segmented` «Все · Черновики · На проверке · Возвращённые · Опубликованные»; строки (кадр `thumbUrl`, «ЖК · Блок · кв.», «снято дд.мм.гггг», статус); черновик — «Продолжить», «Удалить»; возвращённый — причина, «Исправить»; прочие — «Открыть» (`ReportDrawer` только чтение, `closeHref="/video/moi"`); сверху `ProgressTelegram` | руководитель — свои отчёты, без панели Telegram; менеджер — нет |
| `/video/media` | `ProgressMedia`: ЖК (адрес, «Маршрут» — `yandexRouteUrl`, «N отчётов · последний {месяц}»); `?complex=` — месяцы → отчёты: фото (открыть, «Скачать» `?download=`), видео, YouTube | то же |

После «На проверку»: мобилограф → `/video/moi` («Отправлено руководителю»), руководитель → `/video?report=<id>`. В `ReportDrawer` у руководителя для `returned` — «Исправить» → `/video/novyy?id=`.

**Нижняя панель (п. 37)** `components/VideoDock/` (client): `nav.video-dock` с `aria-label`, 4 ссылки lucide (`ListChecks`, `Camera`, `FolderOpen`, `Images`) «Задания · Новый · Мои · Медиа», `aria-current="page"` по `usePathname()`; `position:fixed; bottom:0; padding-bottom: env(safe-area-inset-bottom)`, `z-index: var(--z-video-dock)` (токен в `tokens.css`); только `max-width: 760px`. `useEffect` ставит `--video-dock-h` на `document.documentElement` (снимает при уходе); `ActionToast.css` ≤ 760: `bottom: calc(12px + var(--video-dock-h, 0px))`.

**Форма** `components/ProgressReportForm/` (переписать):
- Поля: ЖК (`SelectField`, заблокирован при правке) → блок (`Choices`, если > 1) → **дата съёмки** (`ShotDateField`, `type="date"`, `min`/`max` из `shotDateBounds(now)`, по умолчанию сегодня по Ташкенту, «Месяц отчёта: {месяц}») → квартира → фото → видео → YouTube → комментарий RU/UZ.
- Фото: «Снять» (`input type=file accept="image/jpeg,image/png,image/webp" capture="environment"`) и «Из галереи» (`multiple`); плитки `working` · `waiting` («ждёт сети», «повтор через N с») · `done` · `error`, «×» 44 px.
- Видео (п. 31): `PHONE_VIDEO_UPLOAD = true` — TUS в `incoming`, `objectName = incomingPath(uid, complexId, "mp4")`, докачка по префиксу `<uid>/<complexId>/`; больше `NEXT_PUBLIC_VIDEO_MAX_MB` (подсказка, по умолчанию 50) или 413 — `videoTooLarge` с советом про YouTube.
- Кнопки (`FormActions`, на 390 липкая полоса над панелью): «Сохранить черновик» (сохраняет загруженные кадры, догружающиеся остаются в очереди — `draftPartial`) и «На проверку» (`photosWait`, `photosMin`, `commentMissing`, `videoWait`, `videoBoth`, `contacts`).
- После первого сохранения черновика — `window.history.replaceState(null, "", "/video/novyy?id=<id>")` (Next синхронизирует `useSearchParams`, сервер не перерисовывает, `key` формы не меняется — очередь живёт); `id` держится в состоянии формы.
- Превью: свежие — blob; сохранённые — `url` из `readProgressReportForEdit` (подписал сервер).
- **Очередь без потерь (п. 37)** `lib/admin/progress/usePhotoQueue.ts` + `uploadRetry.ts`: очередь в памяти; повторы `[2, 5, 10, 30, 60] с` на сетевые и 5xx; без повторов на 400/401/403/413, **кроме «уже существует» (409 / 400 Duplicate) на тот же путь — это успех**; офлайн — ждать `online`. Перезагрузка страницы теряет только незагруженные кадры; загруженные держит черновик (п. 32).

**Ящик проверки** `components/ProgressReview/`: `ReviewScreen.tsx` (вынос `RoleScreen`/`Overview`/`OpenReport` из `video/page.tsx`); `ReportDrawer` — проп `closeHref` (по умолчанию `/video`), адреса из `signProgressFiles`, скрытое поле `version` (`updated_at`) в форме публикации; под фото у руководителя при `review` — `PhotoRemove` («Убрать кадр», подтверждение, неактивна при 3 фото с «Должно остаться не меньше 3 фото»); `ReviewQueue` — `thumbUrl`. Тексты «менеджер вернул / проверит» → «руководитель».

**Telegram мобилографа (п. 36)** — `ProgressTelegram` вверху «Мои отчёты» (профиля в кабинете нет; `AdminUserMenu` — имя и «Выйти»): «Уведомления в Telegram: возвращён — с причиной, опубликован» · «Привязать Telegram» (`t.me`, новая вкладка, «ссылка действует 15 минут») / «Привязан · Отвязать». Состояние — сервером (`staff_telegram_chat` → `boolean`). Нет бота — «Бот не настроен».

**Журнал:** `admin.journal.entities.progress_reports` «Отчёт мобилографа»; `admin.journal.fields.{shot_on, month, comment, photos, video_path, youtube_id, return_note, status}` + значения статусов отчёта; `lib/admin/journal/format.ts` — `photos: [n, n]` как «4 → 3 фото».

**Компоненты — создать:** `VideoLayout/` (server `{role, children}`), `ProgressTasks/` (`{tasks}`), `ProgressMine/` (`ProgressMine.tsx` `{items, filter, showTelegram}`, `MineFilter.tsx`, `DeleteDraft.tsx`), `ProgressTelegram/` (client `{linked, bot}`), `VideoDock/`, `ProgressMedia/` (`MediaComplexes.tsx` `{items}`, `MediaComplex.tsx` `{complex}`), `ProgressReview/{ReviewScreen,PhotoRemove}.tsx`, `ProgressReportForm/{ShotDateField,FormActions}.tsx`.
**Изменить:** `ProgressReportForm/*`, `ProgressReview/{ReportDrawer,ReviewDecision,ReviewQueue}.tsx`, `ProgressOverview/ClientVideos.tsx` («снято» — `shot_on`), `ActionToast/ActionToast.css`. **Удалить:** `components/VideoScreen/` и строку `app/cabinet.css:121`.
**Страницы:** `video/layout.tsx`, `video/page.tsx`, `video/novyy/page.tsx`, `video/moi/page.tsx`, `video/media/page.tsx` — `export const instant = false`, UUID-фильтр параметров.
**i18n** (`messages/ru.json`, только ru): `admin.video.{tabs,dock,tasks,mine,telegram,media,howTo}.*`, `admin.video.form.*` (+ `shotDate`, `shotDateHint`, `shotMonth`, `camera`, `gallery`, `photoWaiting`, `photoRetry`, `draft`, `draftSaving`, `draftSaved`, `draftPartial`, `submitted`, `videoLimit`), `admin.video.review.*` (+ `removeFrame`, `removeFrameConfirm`, `removeFrameMin`, `edit`), `admin.developers.errors.{reportShotDate, reportFiles, reportFrames, reportLimit, copyFailed, telegramNoBot}` (`vh:stale` → существующий `stale`, `contacts` — существующий), журнал — выше. `uz.json` кабинета не трогаем (`messages.test.ts:60-67`).
**`docs/design-decisions.md`** — по строке на «Задания», «Мои отчёты», «Медиа ЖК», нижнюю панель, форму с датой съёмки (мокап их не покрывает).

---

## 4. Сайт
- «Снято дд.мм.гггг» = `shot_on`: меняется только SQL (§E1.2 п. 9). Ключ `shot_at` прежний, значение — дата; `formatDate(new Date("2026-11-03"))` в `Asia/Tashkent` = 03.11.2026.
- Штамп «Обновлено» (`apps/site/app/[locale]/novostroyki/[slug]/sections.tsx:91`, `progress[0].shotAt`) становится датой съёмки первого блока последнего месяца — принимаем, код сайта не меняется.
- `apps/site/lib/site/progress/records.ts:55-56` — комментарий «дата съёмки (shot_on)»; `apps/site/tests/e2e/unit-video.spec.ts:65` — регэксп `/Кв\.\s?\d|№\s?\d/`.
- Публичные адреса прежние (`media`, `progress-video`); `next.config`, плеер, `ANON_FUNCTIONS` не меняются.
**Готово:** `complex-progress.spec`, `unit-video.spec` сайта на 1440 после `db:push` и `demo:seed`.

---

## 5. Тесты

**База (PGlite + `test:db:remote`)** — объекты `storage.objects` вставлять вручную (с `metadata {mimetype,size}` и `created_at`; копию публикации имитирует вставка в `media`/`progress-video`).
- `progress-reports.test.ts` — `shot_on` и incoming: сегодня ✓, завтра ✗, −60 ✓, −61 ✗ `vh:shot_date`; старая дата у `returned` ✓, у черновика −61 → `vh:shot_date`; `month = date_trunc(shot_on)`; `site_unit_video` ключи прежние, порядок по `shot_on`; `shot_at = shot_on`; перенос не сдвигает `updated_at`.
- `progress-drafts.test.ts` (новый) — черновик с 1 фото и одним языком ✓; видит только автор (мобилограф 2, менеджер, руководитель — 0 строк и 0 фото); черновики двух авторов на блок/месяц ✓; черновик A не мешает «На проверку» B ✓, второй отправленный → `vh:duplicate`; правка/удаление своего ✓, чужого — `vh:not_found`; черновик → «На проверку» — одна запись журнала `update`, `created_at` = момент отправки; сохранение черновика в журнал не пишется, удаление `returned` автором — пишется; возвращённый с одним языком сохраняется, статус и причина остаются, «На проверку» без UZ → `vh:comment`; автор не удаляет `review` (`vh:forbidden`); файла нет / чужой incoming / старше 24 ч / `.jpg` с `video/mp4` / jpg > 15 МБ → `vh:invalid`; файл руководителя в возвращённом отчёте проходит у мобилографа; 31-й черновик и 31-й `review` → `vh:limit`.
- `progress-publish.test.ts` (новый) — `progress_publish_files`: только руководитель, без 1.2 → `vh:rule12`, архив → `vh:archived`, повтор отдаёт те же `publish_path`; публикация без копий → `vh:files`; со старой `p_version` или `null` → `vh:stale`; с копиями → пути `complexes/…`, ни одного incoming и `publish_path` у `published`; `return` отдаёт `publish_path` в `removed`; `remove_progress_photo`: менеджер/мобилограф `vh:forbidden`, не `review` — `vh:stale`, 3 фото — `vh:frames`, 4 → 3 (оставшиеся `sort` с дырой, порядок прежний), строка журнала `actor_id` и `{"photos":[4,3]}`, `updated_at` вырос; `progress_tasks` (статусы, свой/чужой черновик, сданный блок скрыт, `left`/`total`, руководитель и менеджер — `null`); `progress_media*` (только опубликованное, без `developer`, архив скрыт, anon — отказ); `progress_incoming_orphans` и `progress_public_refs` (48 ч, ссылки черновиков держат файл, только service_role).
- `storage.test.ts` — мобилограф и руководитель больше не грузят в `media` (отчёты) и `progress-video`; лимит `incoming`/`progress-video` 52428800.
- `project2-access.test.ts` — `incoming`: select только своя папка (руководитель не видит чужие и черновые); удаление своего файла черновика ✓, своего файла отчёта `review` ✗, чужого ✗; insert имени, уже упомянутого в отчёте, ✗.
- `head-second-factor.test.ts` — `unlink_staff_telegram`: мобилограф ✓, руководитель `vh:forbidden`, только service_role; ссылка для менеджера → `false`; смена роли после выдачи ссылки → `complete` = `null`; смена роли снимает привязку, с `head` — ещё TOTP и коды.
- `access-matrix.test.ts` — мобилограф: 0 черновиков коллеги, `submit` по новому телу, `publish`/`remove_progress_photo`/`progress_overview` → отказ; новые функции — в списки по их grant; `ANON_FUNCTIONS` и private-функции anon — без изменений.
- `progress-reminder.test.ts` — вставки с `shot_on`.
- `rpc-contract.test.ts` — без правки: у каждой функции одна перегрузка, ключи вызовов = имена аргументов.

**Юниты:** `lib/admin/progress/types.test.ts` (`shotDateBounds`, `monthOfShot`), `lib/media/path.test.ts` (`incomingPath`, `INCOMING_PATH_PATTERN`, `PROGRESS_PHOTO_PATH_PATTERN`), `lib/admin/server/mediaFiles.test.ts` (маршрутизация бакетов), `lib/admin/progress/notify.test.ts`, `lib/admin/server/progressNotify.test.ts`, `lib/admin/actions/guards.test.ts`, `lib/admin/nav.test.ts`, `lib/admin/progress/uploadRetry.test.ts` (`nextRetryDelay`, `isRetryable`, дубль = успех), `components/ProgressReportForm/issues.test.ts` (черновик vs «На проверку»), `lib/admin/progress/tasks.test.ts`, `lib/leads/server/bot.test.ts` (мобилограф → свой текст, без тревоги), `lib/admin/server/progressPublish.test.ts` (контакты → отказ до копий; 409 = успех; сбой — удаляются только созданные 200 и без ссылок; несовпадение ЖК from/to → отказ; incoming удаляется после успеха; уведомление автору), `lib/geo.test.ts` (`yandexRouteUrl`: `rtext=~lat,lng`, порядок lat,lng), `lib/admin/server/incomingSweep.test.ts`, `lib/admin/journal/format.test.ts` (`photos`).

**e2e (Playwright, 390 и 1440; облако + `SUPABASE_DB_URL`):**
- `tests/e2e/progressFixtures.ts` (новый): `videoFile()` (MP4-заглушка ~200 КБ), `removeE2eProgress()` — отчёты по `author_id` E2E-персон (мобилограф, мобилограф 2, руководитель) под `skip_audit` + их файлы `incoming`/`media`/`progress-video`, `seedReviewReport({photos})` (incoming секретным ключом + строка `review`).
- `global-setup.ts` / `cloud.ts` / `auth.setup.ts` — персона `mobilographer2` («E2E Мобилограф 2»); `global-teardown.ts` — `removeE2eProgress()`.
- `mobilographer-form.spec.ts` (новый): дата по умолчанию сегодня, `min`/`max`; `input[capture=environment]`; черновик с 2 фото и RU ✓ → адрес `?id=`; перезагрузка — кадры на месте; `context.setOffline(true)` во время загрузки → «ждёт сети» → онлайн → «готово»; видео через TUS в `incoming`; «На проверку» без UZ → «Комментарий нужен на двух языках»; 3 фото + UZ → «Отправлено руководителю», `/video/moi`. Скриншоты `pE-form`, `pE-form-offline`.
- `mobilographer-cabinet.spec.ts` (новый): «Задания», «Осталось N из M», «Снять отчёт» → форма с ЖК и блоком; `/video/moi` — фильтры, «Продолжить»/«Удалить»; `mobilographer2` черновик не видит, у него `none`; 390 — панель «Задания · Новый · Мои · Медиа», `aria-current`, тост над панелью; 1440 — панели нет, `AdminTabs` есть; панель Telegram. Скриншоты `pE-tasks`, `pE-mine`, `pE-dock` (390), `pE-telegram`.
- `video-reporter.spec.ts` (переписать): мобилограф отправляет → руководитель: ящик с подписанными кадрами, «Убрать кадр» (4 → 3, затем неактивна) → «Вернуть» → мобилограф «Исправить» → менеджер видит ящик без «Опубликовать», кадры грузятся → руководитель публикует с 1.2 → в базе `complexes/…`, в `incoming` файлов отчёта нет → сайт `/ru/video/<id>` «Снято <дата съёмки>»; «Ссылка» → «Скопировано». Скриншот `pE-review`.
- `video-media.spec.ts` (новый): список ЖК, «Маршрут» → `yandex.uz/maps/?rtext=`, ЖК → месяц → фото 200, «Скачать» с `download=`, нет контактов застройщика. Скриншоты `pE-media`, `pE-media-complex`.
- `auth.spec.ts:247-262` — H1 «Отчёты мобилографа», «Задания».
- Сайт: `complex-progress.spec`, `unit-video.spec`; скриншоты `p5-progress`, `p5-unit-video`.
**Скриншоты приёмки** (один прогон, `--workers=1`, `test-results/screens/<project>/`): `pE-tasks`, `pE-dock`, `pE-form`, `pE-form-offline`, `pE-mine`, `pE-telegram`, `pE-media`, `pE-media-complex`, `pE-review`, `p5-progress`, `p5-unit-video`.

---

## 6. Пакеты работ

Порядок по умолчанию последовательный (вверху). Общие файлы — честно:
- `apps/admin/messages/ru.json` — каждый пакет правит **только свои пространства ключей** (ниже); P0 заранее создаёт пустые объекты `tabs`, `dock`, `tasks`, `mine`, `telegram`, `media` в `admin.video`.
- `apps/admin/app/cabinet.css` — пакеты только добавляют свои `@import` в группу прогресса (l.118-121); P2 ещё удаляет l.121 (`VideoScreen.css`).
- `docs/design-decisions.md`, `PROGRESS.md` — только дописывать свои строки.
- **Временные правки P0 для зелёного typecheck:** `components/VideoScreen/VideoScreen.tsx:13` (`draft` в `STATUS_TONE`; файл потом удаляет P2). Старые `reportMonths`, `ProgressFix`, `readProgressReportForFix`, `readMyProgressReports` P0 оставляет `@deprecated`; удаляют P1 (`ProgressFix`, `readProgressReportForFix`) и P2 (`reportMonths`, `readMyProgressReports`) вместе с последним вызовом.
- `ReportDrawer.tsx`, `ReviewScreen.tsx` — только P3; `video/page.tsx` — только P2 (импортирует `ReviewScreen` от P3, блок 2 раньше блока 3).

**P0 · E1 — база и фундамент** (блок 1)
- Владеет: `supabase/migrations/20261103140000_progress_shot_on.sql`, `20261103150000_progress_mobile_rpc.sql`, `20261103160000_staff_telegram_mobile.sql`; `apps/admin/tests/db/{progress-reports,progress-drafts,progress-publish,storage,project2-access,head-second-factor,access-matrix,progress-reminder}.test.ts`, `tests/db/supabase-shim.sql` (колонки `storage.objects`, если нужны); `apps/admin/scripts/{demoProgress,realContent}.mjs`; `lib/media/path.ts` + `path.test.ts` (`INCOMING_BUCKET`, `INCOMING_PATH_PATTERN`, `PROGRESS_PHOTO_PATH_PATTERN`, `incomingPath(userId, complexId, ext, fileId?)`), `lib/media/index.ts` (реэкспорт); `lib/admin/progress/types.ts` + `types.test.ts` (`"draft"`, `ProgressEdit`, `shotDateBounds`, `monthOfShot`, `ProgressTasks`, `MediaComplex*`, `PHONE_VIDEO_UPLOAD = true`); `lib/admin/server/progress.ts` (`readAuthorProgressReports(sb, authorId, {status?, limit = 100})`, `readProgressReportForEdit(sb, id)`, `readReportDetail`/`readReviewQueue` + `url`/`thumbUrl`, `readProgressTasks`, `readMediaComplexes`, `readMediaComplex`); `lib/admin/server/progressFiles.ts`; `lib/admin/server/mediaFiles.ts` + тест; `lib/admin/progress/notify.ts` + тест; `lib/admin/server/progressNotify.ts` + тест; `lib/admin/developers/errors.ts` (`vh:shot_date`→`reportShotDate`, `vh:files`→`reportFiles`, `vh:frames`→`reportFrames`, `vh:limit`→`reportLimit`); `lib/admin/nav.ts` + `nav.test.ts`; `lib/admin/actions/guards.test.ts`; ключи `admin.developers.errors.*` и пустые пространства; `tests/e2e/{progressFixtures.ts, global-setup.ts, global-teardown.ts, cloud.ts, auth.setup.ts}`; сайт — `apps/site/lib/site/progress/records.ts`, `apps/site/tests/e2e/unit-video.spec.ts`; временная правка `VideoScreen.tsx:13`.
- Проверка: `npx vitest run --project db`, `npm run test:db:remote` (после `db:push`), `npm test -w @vh/admin -- lib/media lib/admin/progress lib/admin/nav lib/admin/actions lib/admin/server`, `npm run typecheck`, `npm run lint`, `npm run e2e:1440 -w apps/site -- complex-progress.spec unit-video.spec`; второй агент по миграциям и правам.

**P1 · E2 — форма и загрузки** (блок 2, после P0)
- Владеет: `components/ProgressReportForm/*` (+ `ShotDateField.tsx`, `FormActions.tsx`, `issues.ts`, `issues.test.ts`); `lib/admin/progress/{usePhotoQueue,useVideoUpload,uploadRetry}.ts` + тесты; `lib/admin/actions/progressReports.ts`; `app/(admin)/(cabinet)/video/novyy/page.tsx`; удаление `ProgressFix`, `readProgressReportForFix`; ключи `admin.video.{form,howTo}.*`; строка `design-decisions` о форме; `tests/e2e/mobilographer-form.spec.ts`.
- Проверка: `npm test -w @vh/admin -- components/ProgressReportForm lib/admin/progress lib/admin/actions`, typecheck, lint, `npm run e2e:1440 -w apps/admin -- mobilographer-form.spec`.

**P3 · E4 — проверка и публикация** (блок 2, после P1)
- Владеет: `components/ProgressReview/*` (`ReviewScreen.tsx`, `ReportDrawer.tsx`, `ReviewDecision.tsx`, `ReviewQueue.tsx`, `PhotoRemove.tsx`, `ProgressReview.css`); `components/ProgressOverview/*`; `lib/admin/actions/progressReview.ts`; `lib/admin/server/{progressPublish.ts, progressPublish.test.ts, progressOverview.ts}`; `lib/admin/journal/format.ts` + тест; ключи `admin.video.{review,matrix,clientVideos}.*`, `admin.journal.entities.progress_reports`, новые `admin.journal.fields.*`; `tests/e2e/video-reporter.spec.ts`.
- Проверка: `npm test -w @vh/admin -- lib/admin/server/progressPublish lib/admin/journal components/ProgressReview`, typecheck, lint, `npm run e2e:1440 -w apps/admin -- video-reporter.spec`.

**P2 · E3 — кабинет мобилографа** (блок 3)
- Владеет: `app/(admin)/(cabinet)/video/{layout.tsx, page.tsx, moi/page.tsx}`; `components/{VideoLayout,ProgressTasks,ProgressMine,ProgressTelegram,VideoDock}/*`; удаление `components/VideoScreen/`, `reportMonths`, `readMyProgressReports`, l.121 `cabinet.css`; `components/ActionToast/ActionToast.css`; `lib/admin/progress/tasks.ts` + тест; `lib/admin/actions/progressTelegram.ts`; `lib/leads/server/bot.ts` + `bot.test.ts`; `packages/shared/styles/tokens.css` (`--z-video-dock`); ключи `admin.video.{tabs,dock,tasks,mine,telegram,title,titleMobilographer,subtitle}`; строки `design-decisions` о «Заданиях», «Моих», панели; `tests/e2e/{mobilographer-cabinet.spec.ts, auth.spec.ts}`.
- Проверка: `npm test -w @vh/admin -- lib/admin/progress/tasks lib/leads/server/bot components`, typecheck, lint, `npm run e2e:1440 -w apps/admin -- mobilographer-cabinet.spec auth.spec`.

**P4 · E5 — «Медиа ЖК»** (блок 3)
- Владеет: `app/(admin)/(cabinet)/video/media/page.tsx`; `components/ProgressMedia/*`; `lib/admin/progress/media.ts` + тест; `lib/geo.ts` (только новая `yandexRouteUrl`) + `lib/geo.test.ts`; ключи `admin.video.media.*`; строка `design-decisions`; `tests/e2e/video-media.spec.ts`.
- Проверка: `npm test -w @vh/admin -- lib/geo lib/admin/progress/media`, typecheck, lint, `npm run e2e:1440 -w apps/admin -- video-media.spec`.

**P5 · E6 — уборка и архив** (блок 3)
- Владеет: `lib/admin/server/incomingSweep.ts` + тест; `lib/leads/server/jobs.ts`; `netlify/functions/cron.mts`; `lib/archive/server/purge.ts` + тест; `apps/admin/.env.example` (+ `NEXT_PUBLIC_VIDEO_MAX_MB`; `TELEGRAM_ALERT_CHAT_ID` уже есть, `:28`).
- Проверка: `npm test -w @vh/admin -- lib/admin/server/incomingSweep lib/archive`, typecheck, lint; на тестовом деплое — `POST /api/cron/incoming` вручную.

**E7 · приёмка:** полный `npm run e2e` обоих приложений 390 + 1440, скриншоты одним прогоном, ревью фазы одним агентом, `db:push` и деплой Netlify обоих сайтов, ручной прогон с телефона (камера, обрыв сети, видео до 50 МБ), `PROGRESS.md`, журнал `docs/progress/project2-phase-e.md`, коммит «проект-2, фаза E: приёмка».

---

## 7. Риски и решения исполнителя

**Решения (PLAN молчит):**
- `month` — колонка с проверкой `month = date_trunc(shot_on)` (не generated): на неё завязаны индексы, сайт, матрица, напоминание.
- Окно даты — 60 дней от сохранения; исключение «дата не менялась» — только у возвращённого.
- Черновик обязан иметь ЖК, блок и дату; пустой комментарий и 0 фото допустимы; возвращённый сохраняется неполным (статус и причина остаются).
- Черновик в журнал не пишется (видит только автор); отправка — одна запись `update` «Черновик → На проверке», `created_at` = момент отправки. «Убрать кадр» — ручная строка `{"photos":[было, стало]}`.
- Автор удаляет только черновик и возвращённый.
- Адрес публикации назначает база (`gen_random_uuid()`, `publish_path`), не клиент: 409 при копии — только наш повтор; уборка удаляет лишь созданные в этом вызове и без ссылок.
- Публикация привязана к версии ящика (`updated_at`): «Убрать кадр» или правка между открытием и публикацией → `stale`.
- Лимит видео — 50 МБ на бакетах `incoming` и `progress-video` + проверка `metadata` в базе; `NEXT_PUBLIC_VIDEO_MAX_MB` — подсказка.
- Потолки: 30 черновиков и 30 отчётов «на проверке» на автора (`vh:limit`) — защита чата тревог от потока.
- Сироты `incoming` — старше 48 ч без ссылки; новый файл берётся в отчёт только моложе 24 ч — уборка не гоняется с привязкой.
- Черновые файлы в `incoming` руководитель не видит: select — только своя папка, ящик и правка возвращённого — подписанные сервером адреса.
- «Задания» — только мобилографу; чужие черновики — `none`, `report_id` — только свой.
- «Мои отчёты» — всегда `author_id = viewer.id` (руководитель видит свои; Telegram-панель — только мобилографу).
- «Медиа ЖК» — все не-архивные ЖК, только опубликованные отчёты, 24 месяца. Маршрут — `yandexRouteUrl` рядом с `yandexMapsUrl` (`lib/geo.ts:76`).
- Telegram мобилографа — в «Мои отчёты»; вид привязки — по роли в базе (`kind`), формат токена общий; смена роли снимает привязку, уход с `head` — ещё TOTP и коды; руководитель отвязывается только сбросом разработчика.
- Уведомление руководителю — в чат тревог (`TELEGRAM_ALERT_CHAT_ID`, как D4).
- Матрица и «Видео для клиентов» у мобилографа уходят; `progress_overview()` закрыт до `head|manager`.
- Правило 1.2 в комментарии — `bilingualHasContact` при отправке и перед публикацией (код `contacts`).

**Отклонено (критики):**
- Сравнение `size`/`eTag` при публикации — не нужно: удаление файла отчёта `review` запрещено политикой, update-политики нет, подмена невозможна.
- Лимит уведомлений в час и счётчик загрузок в сутки — заменены потолком 30 «на проверке»; объём `incoming` чистит уборка.
- Триггер публикации `before insert or update` — триггеры сняты: пути пишут только definer-функции, инвариант проверяют `publish_progress_report` и DB-тест.
- Префикс `m_` и правка `LINK_TOKEN` — не нужны: вид привязки хранит база, бот решает по роли.
- IndexedDB и восстановление формы после перезагрузки — в «Полировку»: п. 37 закрывают очередь в памяти, `online` и черновик.
- Совместимость старой формы в миграции P0 (`media`-политика, `month`) — не держим: тестовый кабинет без раздела видео до E7 (записано выше).

**Риски:**
- Чтение `storage.objects` из `security definer` в облаке — проверить первым на `test:db:remote`. Нет прав — отдельная `progress_confirm_files(p_id, p_paths)` **только `service_role`**, сервер зовёт её после `info()` секретным ключом; флагом в функции `authenticated` — никогда.
- `copy` между бакетами (`storage-js`, `destinationBucket`) — проверить на облаке до UI; `metadata.size`/`mimetype` у объектов TUS — проверить там же.
- `window.history.replaceState` + `useSearchParams` в Next 16 — проверить в `mobilographer-form.spec`; не синхронизируется — `id` только в состоянии формы, адрес меняется при уходе.
- Сбой удаления `incoming` после публикации — файлы до ночной уборки (приватные).
- `capture="environment"` на десктопе игнорируется — есть «Из галереи».
- `video-reporter.spec` сквозной — после P1 и P3; до этого P3 проверяет ящик на `seedReviewReport`.
- DEMO-сид пишет `shot_on`; без `demo:seed` сайт показывает даты переноса (не ошибка).
