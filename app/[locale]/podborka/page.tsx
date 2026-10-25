import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { CatalogGrid } from "@/components/CatalogGrid";
import { Container } from "@/components/Container";
import { Eyebrow } from "@/components/Eyebrow";
import { PodborkaHead } from "@/components/PodborkaHead";
import { SiteHeader } from "@/components/SiteHeader";
import { FAVORITES_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { pageMetadata } from "@/lib/site/metadata";
import { podborkaSlugs } from "@/lib/site/podborka";

type PodborkaProps = PageProps<"/[locale]/podborka">;

/** ЖК подборки в порядке ссылки; снятые с сайта — пропускаются. */
function complexesOf(catalog: SiteCatalog | null, slugs: readonly string[]) {
  return slugs.flatMap((slug) => (catalog?.complexes ?? []).filter((complex) => complex.slug === slug));
}

export async function generateMetadata({ searchParams }: PodborkaProps): Promise<Metadata> {
  const [locale, t, catalog, search] = await Promise.all([getLocale(), getTranslations("favorites.podborka"), readSiteCatalog(), searchParams]);
  const lang = (isLocale(locale) ? locale : DEFAULT_LOCALE) as Locale;
  const complexes = complexesOf(catalog, podborkaSlugs(search.zhk));
  const cover = complexes[0]?.photos[0];
  const names = complexes.map((complex) => complex.name[lang]).join(", ");
  return pageMetadata({
    locale: lang,
    // Адрес превью — с этими ЖК: мессенджеры, которые перечитывают og:url, соберут ту же подборку.
    path: complexes.length > 0 ? `/podborka?zhk=${complexes.map((complex) => complex.slug).join(",")}` : "/podborka",
    title: t("metaTitle", { count: complexes.length }),
    description: names ? t("metaDescription", { names }) : t("metaEmpty"),
    // Превью в Telegram — фото первого ЖК подборки (Ф7 A).
    image: cover
      ? { url: mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", cover.path), width: cover.width, height: cover.height, alt: t("title", { count: complexes.length }) }
      : undefined,
    noindex: true,
  });
}

/**
 * /podborka?zhk=a,b (шаг 3.10, Ф7 A): что видит получатель ссылки — «Подборка: N ЖК», карточки
 * каталога и связь с Vodiy House; без правки, в поиск не идёт. Оболочка статичная, подборка — по
 * адресу, потоком (Suspense).
 */
export default async function PodborkaPage({ searchParams }: PodborkaProps) {
  const t = await getTranslations("favorites.podborka");
  return (
    <>
      <SiteHeader />
      <Container as="main">
        <section className="flex flex-col gap-6 pt-36 pb-24">
          <Eyebrow>{t("eyebrow")}</Eyebrow>
          <Suspense fallback={null}>
            <PodborkaContent searchParams={searchParams} />
          </Suspense>
        </section>
      </Container>
    </>
  );
}

async function PodborkaContent({ searchParams }: Pick<PodborkaProps, "searchParams">) {
  const [locale, catalog, messages, search] = await Promise.all([getLocale(), readSiteCatalog(), getMessages(), searchParams]);
  const complexes = complexesOf(catalog, podborkaSlugs(search.zhk));
  const names = complexes.map((complex) => complex.name[locale as Locale]).join(", ");
  const path = `/${locale}/podborka?zhk=${complexes.map((complex) => complex.slug).join(",")}`;
  return (
    <NextIntlClientProvider messages={pickMessages(messages, FAVORITES_MESSAGES)}>
      <PodborkaHead count={complexes.length} names={names} path={path} />
      {catalog && complexes.length > 0 ? <CatalogGrid catalog={catalog} complexes={complexes} /> : null}
    </NextIntlClientProvider>
  );
}
