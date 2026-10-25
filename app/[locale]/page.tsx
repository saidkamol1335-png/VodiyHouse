import type { Metadata } from "next";
import { locale as rootLocale } from "next/root-params";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { SiteHeader } from "@/components/SiteHeader";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/routing";
import { pageMetadata } from "@/lib/site/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([rootLocale(), getTranslations("meta")]);
  return pageMetadata({
    locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    path: "/",
    title: t("title"),
    description: t("description"),
  });
}

// Заглушка главной фазы 0: обложка и разделы — фаза 3. Шапка — по решениям Ш1–Ш6.
export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <>
      <SiteHeader transparentAtTop />
      <Container as="main">
        <div className="flex flex-col gap-6 pt-40 pb-24">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <Heading level={1} accent={t("titleAccent")}>
            {t("title")}
          </Heading>
          <p className="text-muted-foreground">{t("skeleton")}</p>
        </div>
      </Container>
    </>
  );
}
