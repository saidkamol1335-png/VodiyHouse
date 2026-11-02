import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { FavoritesView } from "@/components/FavoritesView";
import { SiteHeader } from "@/components/SiteHeader";
import { FAVORITES_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("favorites")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.favorites,
    title: t("metaTitle"),
    description: t("metaDescription"),
    // Своё у каждого посетителя — в поиск не идёт.
    noindex: true,
  });
}

/** /izbrannoe (шаг 3.10, Ф7 A): страница статичная, что в избранном — знает только браузер. */
export default async function FavoritesPage() {
  const [t, catalog, messages] = await Promise.all([getTranslations("favorites"), readSiteCatalog(), getMessages()]);
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <section className="flex flex-col gap-6 pt-36 pb-24">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          {catalog ? (
            <NextIntlClientProvider messages={pickMessages(messages, FAVORITES_MESSAGES)}>
              <FavoritesView catalog={catalog} />
            </NextIntlClientProvider>
          ) : null}
        </section>
      </Container>
    </>
  );
}
