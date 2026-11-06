import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { FlatPicker } from "@/components/FlatPicker";
import { HomeCatalog } from "@/components/HomeCatalog";
import { HomeHero } from "@/components/HomeHero";
import { HomeManifesto } from "@/components/HomeManifesto";
import { HomeMarquee } from "@/components/HomeMarquee";
import { HomeOffers } from "@/components/HomeOffers";
import { HomePartner } from "@/components/HomePartner";
import { HomeWhy } from "@/components/HomeWhy";
import { JkGallery } from "@/components/JkGallery";
import { JsonLd } from "@/components/JsonLd";
import { QuizSection } from "@/components/Quiz";
import { Reviews } from "@/components/Reviews";
import { SiteHeader } from "@/components/SiteHeader";
import { SitePreloader } from "@/components/SitePreloader";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { AD_ANCHOR, OFFERS_ANCHOR, QUIZ_ANCHOR } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { availabilitySample, heroFound, homeStats, progressSample } from "@/lib/site/home/stats";
import { readProgressFrames } from "@/lib/site/progress/read";
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

/**
 * Главная (шаг 3.9, мокап Main; порядок 09.10 — решение 3б): первый экран «Ufq» — светлый горизонт, из-за
 * которого при прокрутке встают рендеры-башни (03.11.2026, по схеме hero-1), бегущая строка,
 * каталог с подборками витрины (Ф3 A — тот же компонент, что /novostroyki, 6 карточек),
 * реклама «Предложения от застройщиков» (3.16б, ТЗ 5.4), лента «Проекты» со спецпредложениями ЖК (ТЗ 5.6), квиз «Подбор за 1 минуту» (3.17), «Vodiy House в двух
 * словах», «Почему через Vodiy House» (с плиткой «Видео стройки» — фаза 5), «Вы застройщик?». Страница статичная: всё — из кэшированных
 * ответов каталога и витрины.
 */
export default async function HomePage() {
  const locale = (await rootLocale()) as Locale;
  const [catalog, showcase, frames] = await Promise.all([
    readSiteCatalog(),
    readSiteShowcase(),
    readProgressFrames(),
  ]);
  return (
    <>
      <SitePreloader />
      <SiteHeader transparentAtTop />
      <main>
        <HomeHero
          stats={catalog ? homeStats(catalog) : null}
          found={catalog ? heroFoundOrNull(catalog) : null}
          catalogId={CATALOG_ID}
        />
        <HomeMarquee />
        {catalog ? (
          <HomeCatalog id={CATALOG_ID} catalog={catalog} pageSize={PAGE_SIZE} showcase={showcase} />
        ) : (
          <CatalogUnavailable id={CATALOG_ID} />
        )}
        {catalog ? <FlatPicker catalog={catalog} /> : null}
        {catalog ? <HomeOffers id={AD_ANCHOR} catalog={catalog} showcase={showcase} /> : null}
        {catalog ? <JkGallery id={OFFERS_ANCHOR} catalog={catalog} showcase={showcase} /> : null}
        <QuizSection id={QUIZ_ANCHOR} catalog={catalog} variant="home" />
        <HomeManifesto />
        <HomeWhy
          sample={catalog ? availabilitySample(catalog) : null}
          video={catalog ? progressSample(catalog, frames) : null}
        />
        <Reviews />
        <HomePartner />
      </main>
      <AgencyJsonLd locale={locale} />
    </>
  );
}

/** «Найдено сейчас» — только если по примеру запроса что-то есть: «0 ЖК · 0 кв.» не показываем. */
function heroFoundOrNull(catalog: SiteCatalog) {
  const found = heroFound(catalog);
  return found.complexes > 0 ? found : null;
}

/** schema.org главной (шаг 3.14): агентство, офис и введённые контакты Vodiy House (правило ТЗ 1.2). */
async function AgencyJsonLd({ locale }: { locale: Locale }) {
  const [contacts, t] = await Promise.all([readSiteContacts(), getTranslations("contacts")]);
  return (
    <JsonLd data={agencyLd({ origin: siteOrigin(), locale, office: t("office"), contacts })} />
  );
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
