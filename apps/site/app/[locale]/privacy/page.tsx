import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { TextPage } from "@/components/TextPage";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("privacy")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.privacy,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** /privacy (шаг 3.11, ТЗ 10.2 — ссылка из фразы согласия): черновик до проверки юристом (TODO-заказчик). */
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");
  const sections = (["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((key) => ({ key, title: t(`${key}.title`), text: t(`${key}.text`) }));
  return (
    <>
      <SiteHeader />
      <TextPage eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} sections={sections} footer={<span>{t("edition")}</span>} />
    </>
  );
}
