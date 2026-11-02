import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AboutCta } from "@/components/AboutCta";
import { AboutHero } from "@/components/AboutHero";
import { AboutOffice } from "@/components/AboutOffice";
import { SiteHeader } from "@/components/SiteHeader";
import { ABOUT_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("about")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.about,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/**
 * «О нас» (шаг 3.11, мокап SiteAbout): тёмная карточка с цифрами из базы, офис на карте и «Приезжайте
 * в офис» (заявка «Просмотр — офис»). История и команда — после данных заказчика (TODO-заказчик).
 */
export default async function AboutPage() {
  const [catalog, messages] = await Promise.all([readSiteCatalog(), getMessages()]);
  return (
    <>
      <SiteHeader />
      <main>
        <AboutHero complexes={catalog?.complexes.length || null} />
        <AboutOffice />
        <NextIntlClientProvider messages={pickMessages(messages, ABOUT_MESSAGES)}>
          <AboutCta />
        </NextIntlClientProvider>
      </main>
    </>
  );
}
