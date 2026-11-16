**Item 25 (/o-nas: Tarix and Jamoa): what exists today and a minimal plan**

Everything below was read only. Nothing was changed, run or pushed.

## 1. The /o-nas page today
- **Page:** `apps/site/app/[locale]/o-nas/page.tsx:28-42` renders `AboutHero`, then `AboutOffice`, then `AboutCta`. It reads only `readSiteCatalog()` for the complex count. The comment at lines 24-27 says history and team come later (TODO-заказчик).
- **AboutHero** (`apps/site/components/AboutHero/AboutHero.tsx:19-50`): a dark card with `TimelapseClip` as its background (`.about-hero__media`, hidden on phone) and three stats. The comment at line 15 also says history and team come later.
- **AboutOffice** (`apps/site/components/AboutOffice/AboutOffice.tsx:15-54`): a static map placeholder with Yandex links built from the address text in `contacts.office` (i18n). The office has no map point in the database.
- **AboutCta:** a `LeadButton` for an office visit.
- **Texts:** `apps/site/messages/{ru,uz}.json`, key `about` (ru.json line 1437), with sub-keys `hero.*`, `office.*`, `cta.*`. There are no `history` or `team` keys (not found).
- **Client messages:** `ABOUT_MESSAGES` at `apps/site/lib/i18n/clientMessages.ts:111`.

## 2. How the cabinet stores site-wide content today
**Table `public.settings`** (`20261019160000_staff_dictionaries_audit.sql:199-231`):
- Columns: `key` (format checked), `value jsonb`, `is_public`, `updated_at`.
- RLS: select is allowed if `is_public` or the role is head/manager. Insert, update and delete are head only.
- Audit trigger `settings_audit` at line 375. All changes go to the journal.

**View `public_settings`** (`20261102130000_site_access.sql:15-22`): the only way the anon role reads settings. Anon cannot read any table directly (line 10), and new tables are closed to anon by default (line 12).

**Contacts pattern (the closest model):**
- Page: `apps/admin/app/(admin)/(cabinet)/nastroyki/kontakty/page.tsx`, with `requireSection("settings")` and `settingsTabRedirect`.
- Form: `components/ContactsForm`.
- Parser: `apps/admin/lib/admin/contacts/contactsForm.ts` (uses `readBilingual` / `bilingualIssue` from `../bilingual`).
- Action: `apps/admin/lib/admin/actions/contacts.ts:12-34`. It checks `requireActionViewer(["head"])`, then `settings.upsert({key, value, is_public: true})`, then calls `expireSiteSettings()`.
- Site reader: `apps/site/lib/site/contacts.ts`, using `'use cache'` with `cacheTag(SITE_SETTINGS_TAG)` and `cacheLife("days")`. It returns an empty result on error.

**Manager exception:** `20261106120000_filter_archive.sql` adds manager insert/update policies limited to `key = 'site.filter_archive'`.

**Settings tabs:** `apps/admin/lib/admin/nav.ts:153-189`. The `SettingsTabKey` options are staff, dictionaries, contacts (head only), filter (head and manager) and journal.

**Roles:** `staff_role` is head, manager, and videographer (the mobilographer role).

**Closest content table with people's photos:** `20261103210000_reviews.sql`.
- Its `consent_at`, `consent_by` and `check (not is_published or consent_at is not null)` lines are the consent pattern.
- It has the audit trigger `reviews_audit`, head-only write RLS, and head/manager read.
- The site reads it through the SECURITY DEFINER RPC `site_reviews()` (lines 70-98).
- `photo_path` has the format `reviews/<id>/<file>`. There is no cabinet form yet.

## 3. Media upload
- **Bucket:** `media`, public, 15 MB, jpeg/png only (`20261020090000_media_storage.sql:11-16`).
- **Path check:** `private.is_media_path` was replaced in `20261028150000_showcase.sql:334-355`. It only accepts `(complexes|developers|specials|collections|ads)/<owner uuid>/<uuid>.(jpg|png)` where the owner row exists. The same pattern is in `apps/admin/lib/media/path.ts` (`MEDIA_PATH_PATTERN`), and `apps/admin/tests/db/storage.test.ts` compares the two.
- **Storage policies:** head inserts and deletes (`media_storage.sql:67-79`). Managers may upload complex photos only (`20261102110000_manager_content.sql:123-141`). There is no update policy, so a new photo is always a new file.
- **Rule 1.2 checkbox:** `public.set_showcase_media(..., p_rule12 boolean)` in `showcase.sql` refuses the upload with hint `vh:rule12` unless the box is ticked on every upload. On the cabinet side it is `apps/admin/lib/admin/actions/showcaseMedia.ts:13,47`. There is also `apps/admin/lib/admin/contactGuard.ts`.
- **Browser upload helper:** `apps/admin/lib/admin/storageUpload.ts` (`UploadRefused`). Compression is in `lib/media/process.ts`.
- **Login media** (`apps/admin/lib/admin/loginMedia.ts`): fixed in code. It is not stored in the database or the bucket.

## 4. Cache and the revalidate webhook
- **Admin side:** `apps/admin/lib/cache/index.ts:89-92` defines `SITE_SETTINGS_TAG = "site-settings"` and `expireSiteSettings()`. It calls `updateTag` and queues a signed `POST <site>/api/revalidate` (`lib/cache/site.ts`).
- **Site side:** `apps/site/app/api/revalidate/route.ts:14-35`.
- **Tag allow-list:** `packages/shared/src/revalidate.ts:16` accepts only complexes, developers, dictionaries, site-settings, payment-programs, showcase, and `complex:` / `developer:` / `progress:` + uuid.
- **Gap:** `reviews` is not on that list, although the site defines `REVIEWS_TAG` (`apps/site/lib/cache/index.ts:99`). A new tag would also need to be added there; reusing `site-settings` avoids that.

## 5. Tests touching /o-nas
- `apps/site/tests/e2e/pages.spec.ts:39-42` checks the hero stat and takes the "about" screenshot.
- `apps/site/tests/e2e/timelapse-clip.spec.ts:44-77` checks motion full, none and lite on `.about-hero__media`.
- `footer.spec`, `header.spec` and `motion-reveal.spec` mention o-nas through the route.
- `apps/site/lib/routes.ts` holds `ROUTES.about`.
- There are no unit tests for the about components (not found).

## 6. Proposed minimal plan
**Migration `2026111xxxxxxx_about_team.sql`:**
1. **History:** no new table. Use a settings key `site.about_history`, `is_public = true`, value `[{year:int, title:i18n, text:i18n?}]`, sorted by year. The existing RLS (head writes), audit trigger and `public_settings` already cover it.
2. **Team:** new table `public.team_members`, copied from `reviews`:
   - Columns: `id`, `name text check 2..60`, `position i18n_text`, `photo_path / width / height / blur`, `consent_at`, `consent_by`, `is_published`, `sort`, timestamps.
   - `check (not is_published or consent_at is not null)` and `check (photo_path is null or consent_at is not null)`.
   - `team_members_audit` with `private.write_audit()`.
   - RLS: head writes; head and manager read. Revoke anon.
   - RPC `public.site_team()` (SECURITY DEFINER) returns published members with consent only, ordered by sort.
3. **Storage:** add `team` to `is_media_path` (owner check on `team_members`) and to `MEDIA_PATH_PATTERN` / `MediaOwnerType` in `lib/media/path.ts`, and update `storage.test.ts`. Uploads stay under the existing head policy.
   - Add `set_team_photo(p_id, p_path, w, h, blur)`, head only, which returns the old path.
   - The rule 1.2 checkbox is not needed: it is about developer contacts. The real gate is the consent checkbox.
4. **Site:** add `apps/site/lib/site/about.ts` with `readAboutHistory()` (from `public_settings`) and `readTeam()` (RPC). Both use `'use cache'` + `cacheTag(SITE_SETTINGS_TAG)`, so no new tag is needed and nothing in the allow-list changes.
   - New components `AboutHistory` and `AboutTeam`, placed between `AboutHero` and `AboutOffice`. Each renders nothing when its list is empty.
   - Add `about.history.*` and `about.team.*` to ru/uz.
   - Office, map and CTA stay unchanged.
5. **Cabinet:** a new settings tab "О компании" (`segment "o-kompanii"`, roles `["head"]`).
   - History: a repeatable list (year plus bilingual title and text), saved through a `contactsForm`-style parser and a `requireActionViewer(["head"])` action, then `expireSiteSettings()`.
   - Team: a list with photo upload, name, bilingual position, a "письменное согласие получено" checkbox, publish toggle and order. Actions are head only and call `expireSiteSettings()`.
6. **Roles:** head only, following contacts and reviews. A manager does not need it; a one-line policy like filter_archive's can be added later if the client asks.
7. **TODO-заказчик:** the real history and team data, the team photos, and written consent from each person (personal data law). The site stays hidden while the data is empty.
8. **Tests:**
   - Units for the history parser, the team parser and the path pattern.
   - Extend `storage.test.ts`.
   - `pages.spec`: with empty data, `.about-history` and `.about-team` have count 0, and the hero and office are still visible.
   - Leave `timelapse-clip.spec` unchanged.