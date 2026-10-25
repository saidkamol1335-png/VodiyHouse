import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CatalogResults } from "@/components/CatalogResults";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";
import { CATALOG_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { NO_FILTER, type CatalogFilter } from "@/lib/site/catalog/filter";
import { filterFromSearch } from "@/lib/site/catalog/params";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { pageMetadata } from "@/lib/site/metadata";

type Search = Record<string, string | string[] | undefined>;
type CatalogPageProps = { searchParams: Promise<Search> };

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

/** /novostroyki (Ф3): каталог без обложки; фильтр — из адреса, статичная оболочка — без фильтра. */
export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const [t, catalog, messages] = await Promise.all([getTranslations("catalog.page"), readSiteCatalog(), getMessages()]);
  const results = (filter: CatalogFilter, data: SiteCatalog) => (
    <NextIntlClientProvider messages={pickMessages(messages, CATALOG_MESSAGES)}>
      <CatalogResults catalog={data} initialFilter={filter} pageSize={PAGE_SIZE} />
    </NextIntlClientProvider>
  );
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
            <Suspense fallback={results(NO_FILTER, catalog)}>
              <FilteredResults searchParams={searchParams} render={(filter) => results(filter, catalog)} />
            </Suspense>
          ) : (
            <p className="text-muted-foreground">{t("unavailable")}</p>
          )}
        </section>
      </Container>
    </>
  );
}

async function FilteredResults({ searchParams, render }: { searchParams: Promise<Search>; render: (filter: CatalogFilter) => React.ReactNode }) {
  return render(filterFromSearch(await searchParams));
}
