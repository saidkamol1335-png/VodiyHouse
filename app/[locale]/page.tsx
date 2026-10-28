import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { HomeCatalog } from "@/components/HomeCatalog";
import { HomeHero } from "@/components/HomeHero";
import { HomeManifesto } from "@/components/HomeManifesto";
import { HomeMarquee } from "@/components/HomeMarquee";
import { HomeOffers } from "@/components/HomeOffers";
import { HomePartner } from "@/components/HomePartner";
import { HomeWhy } from "@/components/HomeWhy";
import { JsonLd } from "@/components/JsonLd";
import { SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { OFFERS_ANCHOR } from "@/lib/routes";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { availabilitySample, heroFound, homeStats } from "@/lib/site/home/stats";
import { readSiteContacts } from "@/lib/site/contacts";
import { pageMetadata, siteOrigin } from "@/lib/site/metadata";
import { agencyLd } from "@/lib/site/seo/jsonLd";
import { readSiteShowcase } from "@/lib/site/showcase/read";

/** Карточек на порцию на главной (Ф3 A): 2 ряда по 3; «Показать ещё» добавляет столько же. */
const PAGE_SIZE = 6;
const CATALOG_ID = "katalog";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([rootLocale(), getTranslations("meta")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
}

/** Обложки ЖК по порядку каталога: фон первого экрана и видоискатель. */
function coversOf(catalog: SiteCatalog | null, locale: Locale) {
  return (catalog?.complexes ?? []).flatMap((complex) =>
    complex.photos[0] ? [{ photo: complex.photos[0], name: complex.name[locale] }] : [],
  );
}

/**
 * Главная (шаг 3.9, мокап Main; порядок 09.10 — решение 3б): первый экран без заставки, бегущая
 * строка, каталог с подборками витрины (Ф3 A — тот же компонент, что /novostroyki, 6 карточек),
 * «Предложения от застройщиков» (3.16б), «Vodiy House в двух словах», «Почему через Vodiy House»,
 * «Вы застройщик?». Квиз — 3.17. Страница статичная: всё — из кэшированных ответов каталога и витрины.
 */
export default async function HomePage() {
  const locale = (await rootLocale()) as Locale;
  const [catalog, showcase] = await Promise.all([readSiteCatalog(), readSiteShowcase()]);
  return (
    <>
      <SiteHeader transparentAtTop />
      <main>
        <HomeHero
          stats={catalog ? homeStats(catalog) : null}
          found={catalog ? heroFound(catalog) : null}
          photos={coversOf(catalog, locale)}
          catalogId={CATALOG_ID}
        />
        <HomeMarquee />
        {catalog ? <HomeCatalog id={CATALOG_ID} catalog={catalog} pageSize={PAGE_SIZE} showcase={showcase} /> : <CatalogUnavailable id={CATALOG_ID} />}
        {catalog ? <HomeOffers id={OFFERS_ANCHOR} catalog={catalog} showcase={showcase} /> : null}
        <HomeManifesto />
        <HomeWhy sample={catalog ? availabilitySample(catalog) : null} />
        <HomePartner />
      </main>
      <AgencyJsonLd locale={locale} />
    </>
  );
}

/** schema.org главной (шаг 3.14): агентство, офис и введённые контакты Vodiy House (правило ТЗ 1.2). */
async function AgencyJsonLd({ locale }: { locale: Locale }) {
  const [contacts, t] = await Promise.all([readSiteContacts(), getTranslations("contacts")]);
  return <JsonLd data={agencyLd({ origin: siteOrigin(), locale, office: t("office"), contacts })} />;
}

/** Каталог не прочитался (база не ответила): вместо ленты — короткое «временно недоступен», как /novostroyki. */
async function CatalogUnavailable({ id }: { id: string }) {
  const t = await getTranslations("catalog.page");
  return (
    <Container>
      <p id={id} className="py-16 text-muted-foreground">
        {t("unavailable")}
      </p>
    </Container>
  );
}
