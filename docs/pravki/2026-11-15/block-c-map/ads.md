Read-only map of the showcase ads, discounts, rule 1.2 and catalog code, followed by a proposed plan. Nothing was edited.

## What exists today

**Database tables**
- `public.ads` is created in `supabase/migrations/20261028150000_showcase.sql:103-118`. Columns:
  - `id`, `developer_id` (fk, cascade), `title` and `text` (i18n_text)
  - `complex_ids uuid[]` (at most 20), `filter jsonb`
  - `valid_from`, `valid_to`, `is_active`, `sort`, `created_at`, `updated_at`
- Trigger `check_showcase_complexes` (:144-191) only accepts complexes of the ad's own developer. `forget_showcase_complex` and `forget_moved_showcase_complex` (:195-236) remove deleted or moved complexes from ads.
- Audit trigger: `ads_audit` (:255). `audit_developer_id` maps ads to the developer's journal.
- Discounts: the `private.mentions_discount` check (:14-25) was dropped for the ad and special texts in `20261106150000_showcase_discounts.sql`. It is kept for `collections.title`.
- There is no site setting for discounts (not found).

**Database access rules**
- RLS is on (:463-465).
- Read policy (:479): `showcase_visible(is_active, valid_from, valid_to, developer_id) or is_staff()`. `showcase_visible` checks active, the Tashkent date window and a public developer.
- Insert, update and delete: only `has_role('head')`, created by the loop at :484-500.

**Media for ads**
- `media_assets.ad_id` exists. Only kind `cover` is allowed, one per ad (unique index :343). The folder is `ads/<id>/` (`media_owner_folder` :274; `is_media_path` :347-368).
- `media_kind` enum: `photo, drawing, facade, logo, cover` (`20261019170000…:175`), plus `floor_plan` (`20261029010000`).
- Bucket: `media` (`MEDIA_BUCKET`, `apps/admin/lib/media/path.ts:6`; ads folder :19, regex :23).

**Cover upload and the rule 1.2 checkbox**
- RPCs `set_showcase_media(p_owner, p_id, p_path, …, p_rule12)` and `remove_showcase_media` (:373-438): head only. Without `p_rule12` the call fails with `hint vh:rule12`. The box is ticked per upload, not when the record is switched on.
- Server action: `apps/admin/lib/admin/actions/showcaseMedia.ts:48-75`. It passes `rule12 === "on"` (:69) and calls `expireShowcase()`.
- Wiring: `app/(admin)/(cabinet)/vitrina/mediaActions.ts`, and the client component `components/ShowcaseForm/ShowcaseCover.tsx:22-49`. The upload stays disabled until the box is ticked, and the box is cleared after each upload.
- Checkbox component: `components/Rule12Check/Rule12Check.tsx:6,19`, with context `"showcase"`. Its text is `admin.media.rule12.showcase` in `apps/admin/messages/ru.json:529`.

**Site reader (`site_showcase`)**
- Defined in `20261028180000_site_showcase.sql:23-67` (security definer). It returns `{today, collections[], specials[], ads[]}`.
- Each ad: `{id, title, text, filter, developer{id,slug,name}, complex_ids (public only), valid_to, cover}`, ordered by `sort, created_at`.
- The same file holds the reminder table `showcase_notices` and `take_showcase_reminders` (3 days before an ad ends), and adds `'ad'` to the `events.entity_type` check (:162).

**Events and lead types**
- `ad_view` and `ad_click` are in `20261029180000_events_marks.sql:15,59`. The ad title is resolved at :97.
- `lead_type` enum (`20261026090000_leads.sql:7-10`) already has `promo`. There is no separate ad type.
- Admin labels `promo` as «Спецпредложение» (`ru.json:2691`, :3913) and «Условие: {title}» (:2804).
- Site side: `apps/site/lib/leads/types.ts:17`, and `request.ts:136-138` accepts `payload.promo.title` only.

**Site code**
- `lib/site/showcase/read.ts:15-34` calls the RPC with cache tags `SHOWCASE_TAG`, `CATALOG_TAG`, `DEVELOPERS_TAG`. Types are in `records.ts` (`AdRecord` :34, `ShowcaseAd` :75).
- `model.ts`: `adViewOf` :159, `adView` :234 (first valid ad), `houseAd` :199, `cardBadges` :243, `complexSpecials` :255, `gallerySpecials` :267.
- `components/HomeOffers/HomeOffers.tsx:31-58` shows one `AdCard`, or the house ad if `readHouseAdSettings().enabled`.
- `components/AdCard/AdCard.tsx`: facts, chips, «Показать N», and `LeadButton type:"promo"` (:51). `useAdView.ts` fires `ad_view` at 50% visibility.
- Where specials text (which may contain discounts) is shown: `JkGallery.tsx:80`, `SpecialsGrid/SpecialCard.tsx:25-37`, and card badges via `cardBadges` in `novostroyki/page.tsx:51` and `HomeCatalog.tsx:42`.
- Catalog: `CatalogGrid.tsx:20-27` maps cards with no slot support. `CatalogResults.tsx:164` passes `found.slice(0, shown)`. `novostroyki/page.tsx:46` already reads `showcase`.
- No banner component found. The closest are `AdCard` and `ComplexPreviewBanner`.

**House ad setting (pattern to copy)**
- Settings key `site.house_ad = {enabled}`, default true: `packages/shared/src/houseAd.ts`.
- Site reads `public_settings` (view in `20261102130000_site_access.sql:15`) under `SITE_SETTINGS_TAG`: `apps/site/lib/site/houseAd.ts`.
- Admin: `lib/admin/actions/houseAd.ts` (head, upsert `is_public:true`, `expireSiteSettings`), `lib/admin/server/houseAd.ts`, `components/HouseAdPanel`, `vitrina/reklama/page.tsx:21-37`.

**Cache tags and webhook**
- Site tags: `apps/site/lib/cache/index.ts:16-78`.
- Admin: `expireShowcase`, `markShowcaseStale`, `expireShowcaseNow` (`apps/admin/lib/cache/index.ts:111-128`) and `expireSiteSettings` (:91).
- Webhook: `apps/site/app/api/revalidate/route.ts:29-34`, with `now` and `stale` tag lists.

**Admin form and actions**
- `lib/admin/showcase/adForm.ts`: fields at :27-38, `parseAd` :102 (`allowDiscount:true` :108-109), `adRow` :135.
- `components/ShowcaseForm/AdForm.tsx` (145 lines; title, text, target, FilterFields, ComplexPicker). The cover is attached in `ShowcaseParts.tsx:166`.
- `lib/admin/actions/showcase.ts`: `saveAdAction` :87, head guard :65, `expireShowcase()`.
- Pages: `vitrina/reklama/page.tsx` and `reklama/[id]/page.tsx` (`readShowcaseCover(…,"ad")`).
- `discountGuard.ts:10` regex; its comment says the database mirrors it.

**i18n**
- Site: `showcase.offers`, `showcase.ad` (`tag: "Reklama"`, `label`, `show`, `flats`…) and `showcase.house` in `apps/site/messages/uz.json:1064-1096` and `ru.json:1146-1178`.
- Admin: `admin.media.rule12.*`, and the lead type labels listed above.

**Tests**
- `apps/site/tests/e2e/home.spec.ts:99-150`: `#reklama .ad-card`, the `ad_view` beacon, heading text, the «Показать N квартир» href, the `.ad-card__tag` «Reklama», «Shu shartni xohlayman».
- `apps/site/tests/e2e/rule-1-2.spec.ts:85,127-150`: asserts no `скидк|chegirma|discount` in any sitemap page. This is consistent with discounts default OFF; the spec must keep passing with the setting off. `site-calc-view.spec.ts:9` has the same regex.
- Admin: `showcase.spec.ts` (collections, access), `house-ad.spec.ts`, `lib/cache/cache.test.ts`, `discountGuard.test.ts`, `showcase/forms.test.ts`.
- Unit tests: `apps/site/lib/site/showcase/model.test.ts`, `packages/shared/src/houseAd.test.ts`.

## Proposed plan

**1. New migration, e.g. `2026111610xxxx_ad_banners.sql`**
- Add `media_kind` values `banner` and `banner_mobile` with `alter type … add value`. They must be committed before they are used, so use a separate migration or no same-transaction use.
- Extend `media_assets_kind_by_owner`: both banner kinds require `ad_id is not null`. Add unique indexes `(ad_id) where kind='banner'` and `where kind='banner_mobile'`.
- `ads`: add `cta text not null default 'phone' check (cta in ('phone','lead'))`. Make `title` optional (alt text and lead subject) or keep it required. Keep `complex_ids` and `filter` as an optional click target, or drop them from the form.
- Replace `set_showcase_media` and `remove_showcase_media` with a `p_kind` parameter (`cover|banner|banner_mobile`), keeping the head and `p_rule12` checks unchanged.
- `site_showcase`: in `ads[]` add `banner`, `banner_mobile` (through `private.site_media`), `cta` and `sort`. Ads without a desktop banner are not returned.
- `lead_type`: reuse `promo` and add `payload.source='ad'` plus `ad_id` and the developer name in `subject`, with no enum change. A new enum value `'ad'` would also need a new label everywhere in the lead pipeline. Recommendation: `promo` with a source, labelled «Реклама: {developer}» in admin.
- Discount setting: a settings key `site.show_discounts = {enabled:false}` with `is_public`. No schema change is needed, since the settings RLS already limits editing to the head.

**2. Shared code**
- `packages/shared/src/siteFlags.ts` (or extend `houseAd.ts`) with `discountsSettingsFrom(raw)`, default `{enabled:false}`.

**3. Site**
- Add `readDiscountSettings()` modelled on `lib/site/houseAd.ts`.
- When discounts are off, filter specials whose badge, title or text matches the discount regex. This goes in `model.ts` `cardBadges`, `complexSpecials`, `gallerySpecials` and `visibleSpecials` (or a pre-filter on `showcase.specials`). Ad text is no longer shown on the site, since the banner replaces it.
- New `components/AdBanner` (`<picture>` with a mobile source, «Reklama» tag, button `tel:` to the Vodiy House phone from `readSiteContacts()`, or a `LeadButton` with `type:"promo"` and `promo:{source:"ad", developer}`).
- New `components/AdSlider` for the home page. It replaces the `AdCard` use in `HomeOffers` and keeps `useAdView` per slide.
- Catalog: `CatalogGrid` gets an optional `slots` prop that inserts `AdBanner` after every 6th card, rotating through `showcase.ads`. At most one per screen is handled with CSS (a full row, and min-gap logic: every 6 cards on desktop is about two rows, so at most one is visible).
- Pass ads in `CatalogResults` from `novostroyki/page.tsx`.
- Phone and house-ad fallback behaviour stays as it is.

**4. Admin (head only, same guards)**
- `adForm.ts` and `AdForm.tsx`: add `cta`; dates, order and developer already exist.
- `ShowcaseCover` takes a `kind` (desktop or phone banner), with two uploaders, each with a `Rule12Check context="showcase"`.
- Publishing check: `saveAdAction` refuses `is_active=true` without a desktop banner. Optionally enforce this in the database with a trigger.
- New «Показывать скидки на сайте» switch, as a panel in «Витрина» copied from `HouseAdPanel` and `setHouseAdAction`, calling `expireSiteSettings()` and `expireShowcase()`.
- Admin label for `promo` with the ad source in `ru.json`.

**5. Tests**
- Update `home.spec.ts:99-150`: the banner slider, the «Reklama» tag, `tel:` or «Ariza qoldirish».
- Extend `rule-1-2.spec.ts`: no developer `tel:` in the banner. The discount assertion holds while the default is OFF.
- Add a catalog-slot case to `catalog.spec.ts`, a banner, CTA and discount switch case to admin `showcase.spec.ts`, and unit tests for the setting parser, the special-filtering model and `adForm` `cta`.

The migration, the DEMO banner seed and any cloud write need the user's go-ahead first, per CLAUDE.md. Nothing was pushed.