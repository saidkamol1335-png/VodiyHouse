import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import { TextPage } from "@/components/TextPage";
import { formatPhone } from "@/lib/contacts";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { readSiteContacts } from "@/lib/site/contacts";
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

/**
 * /privacy (шаг 3.11, ТЗ 10.2 — ссылка из фразы согласия): черновик до проверки юристом (TODO-заказчик).
 * «Как связаться» (06.11.2026) — с номером и Telegram из «Настройки → Контакты»; без них — заявка
 * «Перезвоните мне» из подвала (она есть всегда).
 */
export default async function PrivacyPage() {
  const [t, contacts] = await Promise.all([getTranslations("privacy"), readSiteContacts()]);
  const telegram = contacts.telegram ?? contacts.bot;
  const reach = [contacts.phone ? formatPhone(contacts.phone) : null, telegram ? `Telegram @${telegram}` : null].filter(Boolean).join(", ");
  const sections = (["s1", "s2", "s3", "s4", "s5", "s6"] as const).map((key) => ({
    key,
    title: t(`${key}.title`),
    text: key === "s6" && reach ? t("s6.textContacts", { contacts: reach }) : t(`${key}.text`),
  }));
  return (
    <>
      <SiteHeader />
      <TextPage eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} sections={sections} footer={<span>{t("edition")}</span>} />
    </>
  );
}
