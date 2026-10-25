import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { PartnersFormats } from "@/components/PartnersFormats";
import { PartnersHero } from "@/components/PartnersHero";
import { PartnersRequest } from "@/components/PartnersRequest";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteSteps } from "@/components/SiteSteps";
import { PARTNERS_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { PARTNER_ANCHOR } from "@/lib/leads/partner";
import { ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { homeStats } from "@/lib/site/home/stats";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("partners")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.forDevelopers,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** Цифры первого экрана — из того же кэшированного каталога, что главная: ЖК, застройщики, квартиры. */
async function heroStats() {
  const [catalog, t, locale] = await Promise.all([readSiteCatalog(), getTranslations("partners.hero"), getLocale()]);
  if (!catalog || catalog.complexes.length === 0) return [];
  const stats = homeStats(catalog);
  const number = new Intl.NumberFormat((locale as Locale) === "uz" ? "uz-UZ" : "ru-RU");
  return [
    { key: "complexes", value: number.format(stats.complexes), caption: t("complexes", { count: stats.complexes }) },
    { key: "developers", value: number.format(stats.developers), caption: t("developers", { count: stats.developers }) },
    { key: "flats", value: `${number.format(stats.flats)}${stats.partial ? "+" : ""}`, caption: t("flats", { count: stats.flats }) },
  ];
}

async function PartnersSteps() {
  const t = await getTranslations("partners.steps");
  const steps = (["s1", "s2", "s3", "s4"] as const).map((key) => ({ title: t(`${key}.title`), text: t(`${key}.text`) }));
  return (
    <section className="py-16" aria-labelledby="partners-steps-title">
      <Container>
        <Eyebrow>{t("eyebrow")}</Eyebrow>
        <div id="partners-steps-title" className="mt-3.5 mb-8">
          <Heading level={2} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
        </div>
        <SiteSteps steps={steps} />
      </Container>
    </section>
  );
}

/**
 * «Застройщикам» (шаг 3.11, мокап SitePartners): первый экран с цифрами, «Три способа работать
 * вместе», «От заявки до первых продаж», «Заявка на сотрудничество» (заявка «Застройщик ·
 * сотрудничество»). Без доступа застройщика к заявкам и без броней (PLAN; решение 06.10.2026).
 */
export default async function PartnersPage() {
  const [stats, messages] = await Promise.all([heroStats(), getMessages()]);
  return (
    <>
      <SiteHeader />
      <main>
        <PartnersHero stats={stats} formId={PARTNER_ANCHOR} />
        <PartnersFormats />
        <PartnersSteps />
        <NextIntlClientProvider messages={pickMessages(messages, PARTNERS_MESSAGES)}>
          <PartnersRequest />
        </NextIntlClientProvider>
      </main>
    </>
  );
}
