import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { LeadButton } from "@/components/LeadDialog";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteSteps } from "@/components/SiteSteps";
import { TextPage } from "@/components/TextPage";
import { ABOUT_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/routes";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("howToBuy")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: ROUTES.howToBuy,
    title: t("metaTitle"),
    description: t("metaDescription"),
  });
}

/** «Как проходит покупка» (шаг 3.11, мокапа нет — черновик текста, TODO-заказчик): пять шагов и вопросы. */
export default async function HowToBuyPage() {
  const [t, messages] = await Promise.all([getTranslations("howToBuy"), getMessages()]);
  const steps = (["s1", "s2", "s3", "s4", "s5"] as const).map((key) => ({ title: t(`${key}.title`), text: t(`${key}.text`) }));
  const sections = (["q1", "q2", "q3"] as const).map((key) => ({ key, title: t(`${key}.title`), text: t(`${key}.text`) }));
  return (
    <>
      <SiteHeader />
      <TextPage
        eyebrow={t("eyebrow")}
        title={t("title")}
        accent={t("titleAccent")}
        lead={t("lead")}
        sections={sections}
        footer={
          <NextIntlClientProvider messages={pickMessages(messages, ABOUT_MESSAGES)}>
            <span>{t("cta")}</span>
            <LeadButton intent={{ type: "callback" }} />
          </NextIntlClientProvider>
        }
      >
        <SiteSteps steps={steps} />
      </TextPage>
    </>
  );
}
