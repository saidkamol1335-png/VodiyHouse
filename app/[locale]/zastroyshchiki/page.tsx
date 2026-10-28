import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { DevelopersHero } from "@/components/DevelopersHero";
import { DevelopersList, type DeveloperRow } from "@/components/DevelopersList";
import { SiteHeader } from "@/components/SiteHeader";
import { DEVELOPERS_LIST_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { developerChecks, developerComplexes } from "@/lib/site/developers/model";
import { readSiteDevelopers } from "@/lib/site/developers/read";
import type { DeveloperSummary } from "@/lib/site/developers/records";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("developers")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.developers,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Строка списка: ЖК на сайте и «Проверено» — из кэша каталога. */
function rowOf(developer: DeveloperSummary, catalog: SiteCatalog | null): DeveloperRow {
  const complexes = catalog ? developerComplexes(catalog, developer.id) : [];
  return {
    slug: developer.slug,
    name: developer.name,
    logo: developer.logo,
    foundedYear: developer.foundedYear,
    complexes: complexes.length,
    verified: developerChecks(developer, complexes).verified,
  };
}

/**
 * Список застройщиков (шаг 3.15, мокап SiteDevs / MobDevs, ТЗ 8.1): опубликованные по порядку
 * руководителя, поиск по названию на месте. Статичная страница из кэшей застройщиков и каталога.
 */
export default async function DevelopersPage() {
  const [developers, catalog, messages, t] = await Promise.all([
    readSiteDevelopers(),
    readSiteCatalog(),
    getMessages(),
    getTranslations("developers"),
  ]);
  return (
    <>
      <SiteHeader />
      <main>
        <DevelopersHero count={developers ? developers.length : null} />
        <Container>
          {developers ? (
            <NextIntlClientProvider messages={pickMessages(messages, DEVELOPERS_LIST_MESSAGES)}>
              <DevelopersList rows={developers.map((developer) => rowOf(developer, catalog))} />
            </NextIntlClientProvider>
          ) : (
            <p className="pb-16 text-muted-foreground">{t("unavailable")}</p>
          )}
        </Container>
      </main>
    </>
  );
}
