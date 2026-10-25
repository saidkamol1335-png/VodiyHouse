import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { CatalogGrid } from "@/components/CatalogGrid";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";
import { CATALOG_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("catalog.page")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.catalog,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** /novostroyki (Ф3): каталог без обложки; фильтр и сортировка — следующий шаг 3.4. */
export default async function CatalogPage() {
  const [t, catalog, messages] = await Promise.all([getTranslations("catalog.page"), readSiteCatalog(), getMessages()]);
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
              <CatalogGrid catalog={catalog} />
            </NextIntlClientProvider>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )}
        </section>
      </Container>
    </>
  );
}
