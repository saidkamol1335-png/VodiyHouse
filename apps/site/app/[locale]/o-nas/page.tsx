import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { AboutCta } from "@/components/AboutCta";
import { AboutHero } from "@/components/AboutHero";
import { AboutHistory } from "@/components/AboutHistory";
import { AboutOffice } from "@/components/AboutOffice";
import { AboutTeam } from "@/components/AboutTeam";
import { SiteHeader } from "@/components/SiteHeader";
import { ABOUT_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readAbout } from "@/lib/site/about";
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
 * «О нас» (шаг 3.11, мокап SiteAbout; правки 15.11, п. 25 — как у Uzum): тёмная карточка с цифрами из
 * базы, «История» по годам и «Команда» (из кабинета, пусто — разделов нет), офис на карте и «Приезжайте
 * в офис» (заявка «Просмотр — офис»).
 */
export default async function AboutPage() {
  const [catalog, messages, about] = await Promise.all([readSiteCatalog(), getMessages(), readAbout()]);
  return (
    <>
      <SiteHeader />
      <main>
        <AboutHero complexes={catalog?.complexes.length || null} />
        <AboutHistory events={about.history} />
        <AboutTeam members={about.team} />
        <AboutOffice />
        <NextIntlClientProvider messages={pickMessages(messages, ABOUT_MESSAGES)}>
          <AboutCta />
        </NextIntlClientProvider>
      </main>
    </>
  );
}
