import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { getMessages, getTranslations } from "next-intl/server";
import { HiddenNavProvider } from "@/components/HiddenNav";
import { RootDocument } from "@/components/RootDocument";
import { siteMessages } from "@/lib/i18n/clientMessages";
import { isLocale, LOCALES } from "@/lib/i18n/routing";
import { hiddenNav } from "@/lib/routes";
import { readCalculatorInMenu } from "@/lib/site/calculator";
import "../globals.css";
import "../site.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("title"),
    description: t("description"),
    alternates: { languages: { uz: "/uz", ru: "/ru" } },
  };
}

export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  const [calculator, messages] = await Promise.all([readCalculatorInMenu(), getMessages()]);
  return (
    <RootDocument lang={locale} withColumns messages={siteMessages(messages)}>
      <HiddenNavProvider hidden={hiddenNav({ calculator })}>{children}</HiddenNavProvider>
    </RootDocument>
  );
}
