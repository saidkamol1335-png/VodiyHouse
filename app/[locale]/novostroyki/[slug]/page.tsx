import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { ComplexBar } from "@/components/ComplexBar";
import { ComplexGallery } from "@/components/ComplexGallery";
import { ComplexHero } from "@/components/ComplexHero";
import { ComplexNav } from "@/components/ComplexNav";
import { ComplexOffer } from "@/components/ComplexOffer";
import { Container } from "@/components/Container";
import { SiteHeader } from "@/components/SiteHeader";
import { COMPLEX_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import { complexRoute, ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import { readSiteContacts } from "@/lib/site/contacts";
import { readComplexPage } from "@/lib/site/complex/read";
import { COMPLEX_ANCHORS, complexSections } from "@/lib/site/complex/sections";
import { complexSummary } from "@/lib/site/complex/summary";
import { pageMetadata } from "@/lib/site/metadata";
import { ComplexSections } from "./sections";

// Адрес ЖК читается сразу, вне <Suspense>: неизвестный адрес отвечает настоящим 404, а новый ЖК
// рендерится при первом заходе и дальше отдаётся из кэша (у известных — сборка); навигация в
// страницу не обязана быть мгновенной (как у [id] кабинета).
export const instant = false;

/** cacheComponents требует хотя бы один адрес: без облака — заглушка, она ответит «недоступна». */
const FALLBACK_SLUG = "zhk";

export async function generateStaticParams() {
  const catalog = await readSiteCatalog();
  const slugs = (catalog?.complexes ?? []).map((complex) => ({ slug: complex.slug }));
  return slugs.length > 0 ? slugs : [{ slug: FALLBACK_SLUG }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/novostroyki/[slug]">): Promise<Metadata> {
  const [{ slug }, localeRaw, t] = await Promise.all([params, getLocale(), getTranslations("complex")]);
  const locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const result = await readComplexPage(slug);
  if (result.kind !== "page") return { title: t("name", { name: slug }) };
  const { page } = result;
  const name = page.name[locale];
  const cover = page.photos[0];
  const place = page.location?.name[locale];
  return pageMetadata({
    locale,
    path: complexRoute(page.slug),
    title: t("metaTitle", { name }),
    description: t("metaDescription", { name, place: place ? t("metaPlace", { place }) : "" }),
    image: cover
      ? {
          url: mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", cover.path),
          width: cover.width,
          height: cover.height,
          alt: t("name", { name }),
        }
      : undefined,
    // Черновик в предпросмотре сотрудника (шаг 3.6) в поиск не идёт.
    noindex: page.status !== "published",
  });
}

/**
 * Страница ЖК (шаг 3.5, мокап SiteJk / MobJk): статичная, обновляется по тегу ЖК при правке в
 * кабинете (PLAN 3а). Первый экран — крошки, название, галерея и цена; ниже — навигатор и разделы,
 * у которых есть данные (раздел без данных скрыт вместе с пунктом навигатора).
 */
export default async function ComplexPageRoute({ params }: PageProps<"/[locale]/novostroyki/[slug]">) {
  const [{ slug }, messages, localeRaw] = await Promise.all([params, getMessages(), getLocale()]);
  const locale = (isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE) as Locale;
  const [result, contacts, t] = await Promise.all([readComplexPage(slug), readSiteContacts(), getTranslations("complex")]);
  if (result.kind === "missing") notFound();
  if (result.kind === "unavailable") {
    return (
      <>
        <SiteHeader backHref={ROUTES.catalog} />
        <Container as="main">
          <p className="pt-36 pb-12 text-muted-foreground">{t("unavailable")}</p>
        </Container>
      </>
    );
  }
  const { page } = result;
  const name = t("name", { name: page.name[locale] });
  const sections = complexSections(page);
  return (
    <NextIntlClientProvider messages={pickMessages(messages, COMPLEX_MESSAGES)}>
      <SiteHeader overPhoto transparentAtTop transparentOnPhoneOnly pageTitle={name} backHref={ROUTES.catalog} />
      <main>
        <Container>
          <ComplexHero
            page={page}
            gallery={<ComplexGallery photos={page.photos} name={name} locale={locale} />}
            offer={<ComplexOffer summary={complexSummary(page)} contacts={contacts} />}
          />
        </Container>
        <ComplexNav label={t("nav.label")} items={sections.map((key) => ({ id: COMPLEX_ANCHORS[key], label: t(`nav.${key}`) }))} />
        <Container>
          <ComplexSections page={page} sections={sections} name={name} locale={locale} />
        </Container>
        <ComplexBar />
      </main>
    </NextIntlClientProvider>
  );
}
