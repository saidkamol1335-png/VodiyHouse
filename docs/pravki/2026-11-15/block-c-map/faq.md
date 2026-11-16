## FAQ (items 7 + 23): what already exists and a minimal plan

This was read-only: no files, git state, database or servers were touched. Per-complex FAQ is fully built. General Vodiy House FAQ, the home-page block and a /voprosy page do not exist.

### 1. Database

**Per-complex FAQ exists.** Migration `supabase/migrations/20261103120000_complex_faq.sql`:
- **Validator** `private.valid_faq(jsonb)` (lines 6–27): an array of at most 8 items, each `{"q":{"ru","uz"},"a":{"ru","uz"}}`. Questions are 1–160 characters and answers 1–600, both languages required. Execute is granted to `authenticated` and `service_role` (line 53).
- **Column** `public.complexes.faq jsonb not null default '[]'`, with check `complexes_faq_valid` (lines 29–31).
- **Site function** `public.site_complex_faq(p_complex uuid)` (lines 37–47): security definer, gated by `private.can_see_complex`, granted to anon and authenticated (line 50).
- **Who can edit:** RLS on `complexes` lets the head and the manager update (`20261102110000_manager_content.sql:41-44`).

**Settings storage pattern:**
- **Table** `public.settings(key, value jsonb, is_public, updated_at)`. The key must match `^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$` (`20261019160000_staff_dictionaries_audit.sql:199-232`).
- **Read:** anyone sees public rows; head and manager see everything.
- **Write:** insert, update and delete are head only.
- **Audit:** trigger `settings_audit` (line 375).
- **Site view** `public.public_settings` (key, value where `is_public`), select for anon and authenticated (`20261102130000_site_access.sql:15-22`). Anon cannot read tables directly (line 10–12).
- **Manager exception** for a single key: policies with `key = 'site.filter_archive' and is_public and has_role('manager')` (`20261106120000_filter_archive.sql:7-14`).
- **Known keys:**
  - `site.contacts` (`SITE_CONTACTS_KEY`)
  - `site.house_ad` (`packages/shared/src/houseAd.ts:5`)
  - `site.filter_archive` (`packages/shared/src/filterArchive.ts:6`)
  - `exchange.usd_uzs`
- **State trigger:** on `settings` it only reacts to `exchange.usd_uzs` (`20261102120000_stored_site_state.sql:142-151`), so a new key has no side effects there.

### 2. Site readers and component

**Complex page:**
- `apps/site/lib/site/complex/read.ts:25-37` calls the `site_complex_faq` function in parallel with the page data. On error the FAQ is empty. It is cached under `complexTag` and `CATALOG_TAG`.
- `records.ts:267-274` `faqFrom` keeps only pairs where all four texts are filled.
- `model.ts:92` holds `faq: {q,a}[]`.
- `sections.ts:25,48`: anchor `voprosy`, and the section shows only when `faq.length > 0`.
- `sections.tsx:73-78` renders `ComplexSection` + `ComplexFaq`, right before `<LeadMore …/>`. That is already the requested position.

**Settings readers (the pattern to copy):**
- `apps/site/lib/site/contacts.ts` and `houseAd.ts` read `public_settings` with the anon client, using `"use cache"` + `cacheTag(SITE_SETTINGS_TAG)` + `cacheLife("days")`.
- They fall back to a safe default when there is no Supabase env or the query errors.

**Component** `apps/site/components/ComplexFaq/ComplexFaq.tsx`:
- Server component using `<details>`/`<summary>` with no JS.
- Emits FAQPage JSON-LD through `components/JsonLd` (lines 28–37).
- Helpers live in `lib/site/seo/jsonLd.ts` (`JsonLd` type, `serializeJsonLd`). There is no FAQ helper there.
- **CSS:** `ComplexFaq.css` (BEM `.complex-faq__*`) is imported only from `apps/site/app/complex.css:10`. `complex.css` is loaded only by `novostroyki/[slug]/layout.tsx:2`, `video/[id]/layout.tsx:2` and `dev/layout.tsx`. **The home page does not load it**; home uses `site.css`, which imports `HomePartner.css` at line 31.

**Home page** `apps/site/app/[locale]/page.tsx:87`: `<HomePartner />` is the last section in `<main>`, and `AgencyJsonLd` comes after it.

**Text keys:** `complex.faq.title` at `apps/site/messages/ru.json:1124` ("Частые вопросы") and `uz.json:1042` ("Ko‘p beriladigan savollar"). The section-tile label `faq` is at ru:830 and uz:748.

**Other:** no `/voprosy` or `/faq` route exists, and no FAQ entry was found in `lib/routes.ts`. The ТЗ 9.8 entry "/voprosy … 1б Предложение" (`docs/Vodiy_House_TZ_Sayt_vodiyhouse_uz.txt:934-937`) is a proposal, and PLAN.md:429 lists "вопросы покупателей" as deferred.

### 3. Cabinet

**Complex tab:**
- `apps/admin/app/(admin)/(cabinet)/zhk/[id]/o-zhk/page.tsx:24-36` loads data with `readComplexFaq` (`lib/admin/server/complexContent.ts:71-75`) and renders `ComplexFaqForm` with `saveComplexFaqAction`.
- **Action** `lib/admin/actions/complexContent.ts:99-111`:
  - guard allows `["head","manager"]`
  - `parseFaq`, then `complexes.update({faq})`
  - then `expireComplex(id)`
- **Parsing** `lib/admin/complexes/faq.ts`:
  - `FAQ_LIMITS` 8/160/600
  - field names `faqKey`, `faq-<key>-q.ru|uz`
  - blank rows are dropped
  - contacts are blocked through `bilingualHasContact`, which enforces rule 1.2
- **Form** `components/ComplexFaqForm/ComplexFaqForm.tsx`: props `{complexId, faq, action}`, built on `ComplexTabForm` and `useTabSave`. CSS is imported at `app/cabinet.css:39`; text keys are under `admin.complexes.faq` (`messages/ru.json:2261`).

**Settings:**
- Layout `nastroyki/layout.tsx` uses `readySettingsTabs(role)`.
- Tabs in `lib/admin/nav.ts:153-189`, with segments under `ADMIN_ROUTES`:
  - `staff`, `dictionaries`: head + manager
  - `contacts`: `kontakty`, head only
  - `filter`: `filtr`, head + manager
  - `journal`: head only
- Example page and action: `nastroyki/kontakty/page.tsx` with `lib/admin/actions/contacts.ts`. The action uses `requireActionViewer(["head"])`, then `settings.upsert({key, value, is_public:true})`, then `expireSiteSettings()`.

**Cache and webhook:**
- Admin `lib/cache/index.ts:89-92` `expireSiteSettings` sends the `"site-settings"` tag.
- `lib/cache/site.ts` queues the tags and sends a signed POST to `/api/revalidate` after the response.
- The site side is `apps/site/app/api/revalidate/route.ts`.

**Media upload and the 1.2 photo checkbox:** they do not apply to the FAQ, which is text only, so I did not map them.

### 4. Tests

- `apps/admin/tests/db/complex-faq.test.ts`: the manager can save; the database rejects a malformed value; the site sees a published complex's FAQ but not a draft's.
- `apps/admin/lib/admin/complexes/faq.test.ts`: limits match the database; row errors; drafts.
- `apps/admin/tests/db/access-matrix.test.ts:22` lists `site_complex_faq`.
- `apps/admin/lib/admin/actions/guards.test.ts:122` covers `saveComplexFaqAction`.
- `apps/admin/tests/e2e/complexes-screens.spec.ts:151-162`: the "Частые вопросы" panel (add a question, save).
- `apps/admin/lib/cache/cache.test.ts:78-80,126` checks that actions call the cache functions.
- **The site has no FAQ tests** (unit or e2e under `apps/site/tests`).

### 5. Minimal plan

**Migration** `supabase/migrations/2026111xxxxxxx_site_faq.sql`, with no new table:
- Add a check on `public.settings`: `key <> 'site.faq' or private.valid_faq(value)`. Raise the limit for this key if more than 8 general questions are wanted, for example by adding a `p_max` parameter to `valid_faq` or writing a `valid_site_faq` wrapper.
- Add two manager policies on `settings` for insert and update, copied from `filter_archive.sql`: `key = 'site.faq' and is_public and has_role('manager')`.
- Head already has rights. The audit comes from the existing `settings_audit` trigger. Anon reads it through the existing `public_settings` view, so no new function is needed.
- **Recommended role:** head and manager, the same as per-complex FAQ and the filter archive. Head-only is the alternative, like contacts.

**Shared code:** add `packages/shared/src/faq.ts` with `SITE_FAQ_KEY = "site.faq"`, the type `FaqItem`, `faqFrom` (moved from `apps/site/lib/site/complex/records.ts:267`), and optionally `faqLd(items, locale)`.

**Site:**
- **Reader** `apps/site/lib/site/faq.ts` `readSiteFaq()`: copy of `houseAd.ts`, with `cacheTag(SITE_SETTINGS_TAG)` and `[]` as the fallback.
- **One component:** generalise `ComplexFaq` into `components/FaqAccordion` (`.faq-accordion` BEM, built on `details`).
  - The CSS has to move from `complex.css` to `site.css`, because the home page does not load `complex.css`. Otherwise the CSS must be imported into both files.
  - The component emits a single FAQPage JSON-LD, with nothing rendered when there are no items.
- **Home:** `const faq = await readSiteFaq()` goes into the `Promise.all` at `page.tsx:55`. Render `{faq.length ? <HomeFaq …/> : null}` after `<HomePartner />` (line 87), with an h2 from a new key `home.faq.title` in both language files.
- **Complex page:** in `sections.tsx:73`, show `[...page.faq, ...general]`: complex questions first, then general ones.
  - Read `general` through `readSiteFaq` in `read.ts` or in `sections.tsx`. The nested `SITE_SETTINGS_TAG` carries up into the page's cache.
  - Update `sections.ts:48` to check the combined length.
  - Emit one FAQPage per page and do not duplicate it.
- **/voprosy (ТЗ 9.8):** not built. It is out of scope for items 7 + 23 unless the client asks for it.

**Cabinet:**
- **Tab:** new settings tab `{key:"faq", segment:"voprosy", roles:["head","manager"]}` in `nav.ts`, `ADMIN_ROUTES.siteFaq`, and the page `nastroyki/voprosy/page.tsx`.
- **Form:** reuse `ComplexFaqForm`. Make `complexId` optional, or extract `FaqForm` and keep `ComplexFaqForm` as a thin wrapper.
- **Action** `saveSiteFaqAction` in `lib/admin/actions/siteFaq.ts`: `requireActionViewer(["head","manager"])`, `parseFaq` (limits possibly per key), `settings.upsert({key:SITE_FAQ_KEY, value, is_public:true})`, then `expireSiteSettings()`. Add it to `guards.test.ts` and `cache.test.ts`.
- **Text:** new keys `admin.settings.tabs.faq` and `admin.siteFaq.*` in `apps/admin/messages/ru.json`.

**Tests:**
- Database test: the manager can upsert `site.faq`, malformed data is rejected, anon sees it in `public_settings`.
- Site unit tests: `faqFrom`, plus a FAQPage JSON-LD test with mixed questions.
- One 1440 e2e on the site, after a DEMO seed with a general FAQ: the block shows on the home page and on a complex page, and is hidden when empty.

The migration and the cloud `db:push` both need the user's confirmation under CLAUDE.md. Do not push (user instruction).