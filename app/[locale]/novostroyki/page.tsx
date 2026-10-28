import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { CatalogResults } from "@/components/CatalogResults";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";
import { CATALOG_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";
import { cardBadges, visibleCollections } from "@/lib/site/showcase/model";
import { readSiteShowcase } from "@/lib/site/showcase/read";

/** Карточек на порцию: 4 ряда по 3 на десктопе (на главной — 6, Ф3). */
const PAGE_SIZE = 12;

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog.page")]);
  // canonical — без параметров фильтра (фаза 3, «Индексация»).
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.catalog,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * /novostroyki (Ф3): каталог без обложки, страница статичная — карточки в первом HTML (LCP).
 * Фильтр и подборка витрины (?podborka=, 3.16б) из адреса применяет браузер сразу после загрузки
 * (CatalogResults); чтение searchParams на сервере делало выдачу потоковой — список рисовался
 * дважды, и LCP ждал второй (замер 3.4). Ряда подборок, рекламы и спецпредложений здесь нет (Ф3).
 */
export default async function CatalogPage() {
  const [t, catalog, messages, showcase] = await Promise.all([getTranslations("catalog.page"), readSiteCatalog(), getMessages(), readSiteShowcase()]);
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <section className="flex flex-col gap-6 pt-36 pb-12">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <Heading level={1} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
          {catalog ? (
            <NextIntlClientProvider messages={pickMessages(messages, CATALOG_MESSAGES)}>
              <CatalogResults catalog={catalog} pageSize={PAGE_SIZE} collections={visibleCollections(catalog, showcase)} badges={cardBadges(showcase)} />
            </NextIntlClientProvider>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )}
        </section>
      </Container>
    </>
  );
}
