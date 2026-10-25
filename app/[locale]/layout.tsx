import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { getMessages, getTranslations } from "next-intl/server";
import { HiddenNavProvider } from "@/components/HiddenNav";
import { RootDocument } from "@/components/RootDocument";
import { SiteContactsProvider } from "@/components/SiteContacts";
import { SiteFooter } from "@/components/SiteFooter";
import { siteMessages } from "@/lib/i18n/clientMessages";
import { isLocale, LOCALES } from "@/lib/i18n/routing";
import { hiddenNav } from "@/lib/routes";
import { readCalculatorInMenu } from "@/lib/site/calculator";
import { readSiteContacts } from "@/lib/site/contacts";
import { SITE_NAME, siteOrigin } from "@/lib/site/metadata";
import "../globals.css";
import "../site.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Только общее для всех страниц: адреса — от домена сайта; canonical, hreflang и Open Graph
// страница задаёт сама (pageMetadata) — иначе калькулятор наследовал бы hreflang главной.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(siteOrigin()),
    title: t("title"),
    description: t("description"),
    applicationName: SITE_NAME,
  };
}

export default async function SiteLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  const [calculator, contacts, messages] = await Promise.all([
    readCalculatorInMenu(),
    readSiteContacts(),
    getMessages(),
  ]);
  return (
    <RootDocument lang={locale} withColumns messages={siteMessages(messages)}>
      <SiteContactsProvider contacts={contacts}>
        <HiddenNavProvider hidden={hiddenNav({ calculator })}>
          {children}
          <SiteFooter />
        </HiddenNavProvider>
      </SiteContactsProvider>
    </RootDocument>
  );
}
