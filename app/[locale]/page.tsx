import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { HomeCatalog } from "@/components/HomeCatalog";
import { HomeHero } from "@/components/HomeHero";
import { HomeManifesto } from "@/components/HomeManifesto";
import { HomeMarquee } from "@/components/HomeMarquee";
import { HomePartner } from "@/components/HomePartner";
import { HomeWhy } from "@/components/HomeWhy";
import { SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { availabilitySample, heroFound, homeStats } from "@/lib/site/home/stats";
import { pageMetadata } from "@/lib/site/metadata";

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
 * Главная (шаг 3.9, мокап Main): первый экран без заставки, бегущая строка, каталог (Ф3 A — тот же
 * компонент, что /novostroyki, 6 карточек), «Vodiy House в двух словах», «Почему через Vodiy
 * House», «Вы застройщик?». Подборки, спецпредложения и квиз — с 3б. Страница статичная: всё — из
 * одного кэшированного ответа каталога.
 */
export default async function HomePage() {
  const locale = (await rootLocale()) as Locale;
  const catalog = await readSiteCatalog();
  return (
    <>
      <SiteHeader transparentAtTop />
      <main>
        {catalog ? (
          <HomeHero stats={homeStats(catalog)} found={heroFound(catalog)} photos={coversOf(catalog, locale)} catalogId={CATALOG_ID} />
        ) : null}
        <HomeMarquee />
        {catalog ? <HomeCatalog id={CATALOG_ID} catalog={catalog} pageSize={PAGE_SIZE} /> : null}
        <HomeManifesto />
        <HomeWhy sample={catalog ? availabilitySample(catalog) : null} />
        <HomePartner />
      </main>
    </>
  );
}
