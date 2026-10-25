import { getTranslations } from "next-intl/server";
import { ComplexBlocks } from "@/components/ComplexBlocks";
import { ComplexDetails } from "@/components/ComplexDetails";
import { ComplexDeveloper } from "@/components/ComplexDeveloper";
import { ComplexDocuments } from "@/components/ComplexDocuments";
import { ComplexFacts } from "@/components/ComplexFacts";
import { ComplexLayouts } from "@/components/ComplexLayouts";
import { ComplexLocation } from "@/components/ComplexLocation";
import { ComplexSection } from "@/components/ComplexSection";
import { ComplexStock } from "@/components/ComplexStock";
import { ComplexVideos } from "@/components/ComplexVideos";
import { formatDayTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { LEAD_FORM_ENABLED } from "@/lib/site/flags";
import { readSiteCalcHints } from "@/lib/site/hints";
import { layoutCards } from "@/lib/site/complex/layouts";
import type { ComplexPage } from "@/lib/site/complex/model";
import { COMPLEX_ANCHORS, type ComplexSectionKey } from "@/lib/site/complex/sections";
import { stockRows } from "@/lib/site/complex/stock";
import { complexFacts, complexSummary } from "@/lib/site/complex/summary";

type ComplexSectionsProps = {
  page: ComplexPage;
  sections: readonly ComplexSectionKey[];
  name: string;
  locale: Locale;
};

/** Разделы страницы ЖК под навигатором — по порядку и только те, у которых есть данные. */
export async function ComplexSections({ page, sections, name, locale }: ComplexSectionsProps) {
  const t = await getTranslations("complex");
  const has = (key: ComplexSectionKey) => sections.includes(key);
  const cards = layoutCards(page);
  return (
    <>
      {has("about") ? (
        <ComplexSection id={COMPLEX_ANCHORS.about} title={t("about.title")} lead={page.shortDescription?.[locale]} tight>
          <ComplexFacts facts={complexFacts(page, locale)} />
          <ComplexBlocks page={page} />
        </ComplexSection>
      ) : null}
      {has("location") ? <LocationSection page={page} name={name} locale={locale} /> : null}
      {has("stock") ? <StockSection page={page} cards={cards} /> : null}
      {has("layouts") ? (
        <ComplexSection id={COMPLEX_ANCHORS.layouts} title={t("layouts.title")}>
          <ComplexLayouts sectionId={COMPLEX_ANCHORS.layouts} cards={cards} hints={await readSiteCalcHints()} leadEnabled={LEAD_FORM_ENABLED} />
        </ComplexSection>
      ) : null}
      {has("video") ? (
        <ComplexSection id={COMPLEX_ANCHORS.video} title={t("video.title")}>
          <ComplexVideos videos={page.videos} name={page.name[locale]} />
        </ComplexSection>
      ) : null}
      {has("details") ? (
        <ComplexSection id={COMPLEX_ANCHORS.details} title={t("details.title")}>
          <ComplexDetails details={page.details} />
        </ComplexSection>
      ) : null}
      <ComplexSection id={COMPLEX_ANCHORS.developer} title={t("developer.title")}>
        <ComplexDeveloper page={page} />
      </ComplexSection>
      {has("documents") ? (
        <ComplexSection id={COMPLEX_ANCHORS.documents} title={t("documents.title")} lead={t("documents.lead")}>
          <ComplexDocuments documents={page.documents} />
        </ComplexSection>
      ) : null}
    </>
  );
}

async function LocationSection({ page, name, locale }: { page: ComplexPage; name: string; locale: Locale }) {
  const t = await getTranslations("complex.location");
  const address = [page.address?.[locale], page.location?.name[locale]].filter(Boolean).join(", ");
  return (
    <ComplexSection
      id={COMPLEX_ANCHORS.location}
      title={t("title")}
      lead={address && page.minutesToCenter ? t("lead", { address, n: page.minutesToCenter }) : address || null}
    >
      <ComplexLocation
        name={name}
        address={page.address?.[locale] ?? null}
        point={page.point}
        nearby={page.nearby}
        minutesToCenter={page.minutesToCenter}
        city={page.location?.name[locale] ?? null}
        landmark={page.landmark?.[locale] ?? null}
      />
    </ComplexSection>
  );
}

async function StockSection({ page, cards }: { page: ComplexPage; cards: ReturnType<typeof layoutCards> }) {
  const t = await getTranslations("complex.stock");
  const updated = page.stockUpdatedAt ? t("updated", { date: formatDayTime(new Date(page.stockUpdatedAt)) }) : null;
  return (
    <ComplexSection id={COMPLEX_ANCHORS.stock} title={t("title")} lead={t("lead")} stamp={updated}>
      <ComplexStock page={page} rows={stockRows(page)} free={complexSummary(page).free} withLayouts={new Set(cards.map((card) => card.layout.rooms))} />
    </ComplexSection>
  );
}
