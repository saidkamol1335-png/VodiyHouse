Report: item 22, "Loyiha tafsilotlari" as a photo-and-caption carousel (read-only check, nothing changed)

**Database (supabase/migrations)**
- **Topics:** `public.detail_topics` (id smallint identity, slug, name i18n_text, sort, is_active) is defined in `20261019160000_staff_dictionaries_audit.sql:142`. Six topics are seeded at :357–363: about, quality, landscaping, amenities, location, engineering. Its RLS follows the dictionary pattern at :175: everyone reads, the head edits.
- **Details table:** `public.complex_details` is defined in `20261025180000_complex_page.sql:60–73`.
  - Columns: id uuid, complex_id → complexes (cascade), topic_id → detail_topics (restrict), text i18n_text not null with ≤2000 chars per language, photo_id → media_assets (on delete set null).
  - Constraint: **unique(complex_id, topic_id)**, so each topic can appear only once per complex.
  - There is **no sort column**. The site order follows the topic dictionary.
  - Indexes: topic_idx and photo_idx.
- **RLS:** set in the same file at :100–140. Select is allowed for anon and authenticated when `private.is_public_complex(complex_id) or private.is_staff()`. Insert, update and delete were head only. Each table also gets an audit trigger `%s_audit` (:136).
- **Manager access:** `20261102110000_manager_content.sql` changed the policies to head + manager (:93–118). It also patched the body of `save_complex_details` to `has_role('head','manager')` (:9–33).
- **Save RPC:** `public.save_complex_details(p_complex uuid, p_details jsonb)` is at `20261025180000_complex_page.sql:314–366`. It also checks `locked_complex_status`.
  - Input: up to 20 items of `{topic_id, text, photo_id|null}`.
  - Topics must exist and must not repeat.
  - The photo must be a media_assets row of this complex with `kind='photo'`.
  - Topics missing from the list are deleted, then the rest are upserted on (complex_id, topic_id).
  - Grants are at :526–537.
- **Site read:** `private.complex_page_content(p_complex)` is at :713–741. Its `details` field holds `{slug, name, text, photo: private.site_media(m)}` ordered by `t.sort, t.id`. `site_media` is at :592.
  - `public.site_complex(slug)` appends `|| private.complex_page_content(c.id)`. Its latest definition is in `20261101120000_publication_rule_v2.sql:379`.
- **Journal:** the topic name is the journal subject (`20261029080000_journal_context.sql:79,211`; `20261029100000_progress_reports.sql:515`).
- **Media:**
  - `media_assets` is defined in `20261019170000_developers_complexes_media.sql:177`: kind enum, path, width/height, blur, focus_x/y, alt i18n, sort.
  - `photo_category` ('general' | 'apartment' | 'real') was added in `20261101120000_publication_rule_v2.sql:16`.
  - Files live in the `media` bucket, at paths `complexes/<complexId>/<uuid>.(jpg|png)` (`private.is_media_path`, `20261020090000_media_storage.sql:32`).
- **Rule 1.2:** it is enforced per complex, not per photo: `complexes.files_checked_at` is set by "Опубликовать" (`20261021090000_complexes_admin.sql:10–13`), and a manager cannot change it (`manager_content.sql:71`). The comment at `complex_page.sql:67` relies on this: a detail photo is picked from the gallery, so it already carries the 1.2 mark. **No separate upload or checkbox exists for detail photos.**
- **Closest pattern for a list with order:** `save_complex_videos` (`complex_page.sql` around :290–311) stores `sort = ord*10` from the array order. FAQ (`20261103120000_complex_faq.sql`) uses a jsonb column.

**Site (apps/site)**
- **Records and model:** `lib/site/complex/records.ts:96` (record type) and `:252` (`photo: photoFrom(detail.photo)`), `lib/site/complex/model.ts:83`.
- **Section presence:** `lib/site/complex/sections.ts:21` (anchor `detali`) and `:45` (shown only when details exist).
- **Rendering:** `app/[locale]/novostroyki/[slug]/sections.tsx:4,64–66` renders `<ComplexDetails details complexName>`.
- **Current component:** `components/ComplexDetails/` contains ComplexDetails.tsx (207 lines), ComplexDetails.css (393), geometry.ts with its test, and useDetailLens.ts.
  - It is a 3D wall: 6 columns × 3 copies, a hover lens, a hidden key list for keyboard and screen reader, and a `<dialog>` with a FLIP animation.
  - Motion uses `[data-motion=full|lite]` selectors (CSS :93–102 and :239–268) and `getMotionTier()` in DetailDialog.
- **Large-view candidate:** `components/ComplexGallery/GalleryViewer.tsx` (110 lines) with GalleryViewer.css (114).
  - It is a `<dialog class="complex-viewer">` with a scroll-snap track, ← → keys, prev/next arrows, a counter `t("counter",{n,total})`, and preloading of 2 neighbours. Smooth scrolling happens only in the full motion tier.
  - It takes `photos: CatalogPhoto[]` only: **no caption slot and no text-only slide**. `useViewer` is not exported.
  - It is used at `ComplexGallery.tsx:84`.
- **Cache:** `lib/site/complex/read.ts:46–51` calls `site_complex` and sets `cacheTag(complexTag(id), developerTag(...))`. The webhook is `app/api/revalidate/route.ts`, with shared code in `packages/shared/src/revalidate.ts`.
- **i18n:**
  - `messages/uz.json:976–982` and `ru.json:3781–3786` hold `complex.details` with title, readMore, close, prev, next. There is **no counter key in this namespace**.
  - `complex.gallery` (uz:700–710) has counter, photo, prev, next, close.
  - The nav label is at uz:743.

**Cabinet (apps/admin)**
- **Page:** the "О ЖК" tab is `app/(admin)/(cabinet)/zhk/[id]/o-zhk/page.tsx`. It reads details and photos (`readComplexPhotos`, `lib/admin/server/complexTabs`) at :24–34.
- **Server read:** `lib/admin/server/complexContent.ts:32–39` reads the `detail_topics` dictionary and `complex_details`.
- **Form logic:** `lib/admin/complexes/details.ts` has DetailRow, `detailRows` (one row per active topic), and `parseDetails`.
  - Field names: `detailTopic`, `detail-<id>-text.ru|uz`, `detail-<id>-photo`.
  - Rules: an empty topic is skipped; a photo without text is an error (`photoWithoutText`); contacts are blocked (`bilingualHasContact`, rule 1.2); max 2000 chars.
- **Action:** `lib/admin/actions/complexContent.ts:86–97`, `saveComplexDetailsAction`. It uses `editGuard` (head + manager), calls the RPC, then `expireComplex(id)`.
- **Cache reset:** `lib/admin/cache/index.ts:20–44` applies `updateTag` locally and queues the same tag for the site webhook (`./site.ts`).
- **Form component:** `components/ComplexDetailsForm/ComplexDetailsForm.tsx` shows one `<details>` per topic, a BilingualField, and photo radio buttons ("Без фото" or a gallery thumbnail).
- **Messages:** `messages/ru.json:2084–2096` (`admin.complexes.details.*`).
- **Demo data:** `lib/admin/complexes/demoContent.ts:30`, `scripts/realContent.mjs:459–466`, `supabase/demo/seed.sql:168`. All of them insert without a sort value.

**Tests**
- **Site e2e:** `tests/e2e/complex-page.spec.ts:132–136` ("Namuna", nav link "Детали проекта", `#detali` contains "Благоустройство").
- **Site unit:** `components/ComplexDetails/geometry.test.ts`.
- **Admin unit:**
  - `lib/admin/complexes/content.test.ts:145–175` (parseDetails, detailRows).
  - `lib/admin/actions/guards.test.ts:120`.
- **Admin e2e:** `tests/e2e/complexes-content.spec.ts:87–99` (panel "Детали проекта", `<details>` per topic, "пусто").
- **DB tests:** `tests/db/site-complex.test.ts:58,123` (expects the order about, quality, landscaping), `:196–202`, `:242–280` (the RPC), `:325–333` (journal), `:348–354`.
- No other tests found.

**Proposed minimal plan**
1. **Migration** `2026111xxxxxxx_complex_details_carousel.sql`:
   - `alter table complex_details add column sort integer not null default 0`.
   - Drop `unique(complex_id, topic_id)` so a topic can have several cards. If one card per topic is preferred, keep the constraint and only add sort; this is a question for the interview.
   - Index `(complex_id, sort)`.
   - `create or replace function public.save_complex_details`:
     - payload items: `{id|null, topic_id, text, photo_id|null}`;
     - role check `private.has_role('head','manager')` written directly, because the patch in 20261102110000 does not apply to new definitions;
     - keep the existing checks: up to 20 items, topic exists, photo belongs to this complex's gallery, `locked_complex_status`;
     - delete rows whose id is missing, update by id, insert new rows, `sort = ord*10`;
     - this keeps the journal clean, unlike a delete-and-reinsert.
   - `create or replace function private.complex_page_content` with `order by d.sort, t.sort, t.id`, also returning `id`. `site_complex` does not need to change.
   - RLS needs no change: the existing policies already cover head + manager. Re-issue the revoke and grant on the function.
   - Existing rows all have sort 0, so the topic order still applies as the tie-break and the DB test at :123 stays valid.
2. **Cabinet:**
   - Rework `details.ts` and `ComplexDetailsForm` into an ordered list like the videos form: add item, delete, move up/down, a topic dropdown, BilingualField, PhotoChoice reused as is.
   - Update the parse and payload code to carry `id` and order. Drop the `photoWithoutText` rule. Keep the contacts guard and the 2000-char limit.
   - Editable by **head and manager**, as today. Photos come only from the complex gallery, so no new upload and no new 1.2 checkbox.
3. **Site:**
   - Replace the 3D wall in `ComplexDetails`. It becomes a horizontal scroll-snap carousel of cards: photo plus topic name plus a short excerpt of the text. A card without a photo shows text only.
   - Clicking a card opens a viewer with the large photo and full text, arrows, and an `n / N` counter.
   - Reuse by exporting `useViewer` from `GalleryViewer.tsx` and the `.complex-viewer` CSS. Add a `DetailViewer` whose slides are a figure plus caption, or a text panel when there is no photo.
   - Remove `geometry.ts`, its test, and `useDetailLens.ts`.
   - Motion: smooth scroll and fade only in full mode. Keep two `[data-motion]` CSS variants, using transform and opacity only.
   - Add `complex.details.counter` and `open` to `uz.json` and `ru.json`. Add `id` to `records.ts` and `model.ts`.
4. **Tests:** update `content.test.ts`, `complexes-content.spec.ts`, `site-complex.test.ts` (:242–280 to the new payload), and `complex-page.spec.ts:132` (add opening the viewer and checking the counter).