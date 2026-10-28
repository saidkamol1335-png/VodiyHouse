import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Container } from "@/components/Container";
import { DeveloperAbout } from "@/components/DeveloperAbout";
import { DeveloperHero } from "@/components/DeveloperHero";
import { DeveloperObjects } from "@/components/DeveloperObjects";
import { DeveloperOthers } from "@/components/DeveloperOthers";
import { DeveloperPrograms } from "@/components/DeveloperPrograms";
import { DeveloperDelivered } from "@/components/DeveloperDelivered";
import { JsonLd } from "@/components/JsonLd";
import type { LeadIntent } from "@/components/LeadForm";
import { SiteHeader } from "@/components/SiteHeader";
import { DEVELOPERS_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import { developerRoute, ROUTES } from "@/lib/routes";
import { readSiteCatalog } from "@/lib/site/catalog/read";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { developerChecks, developerComplexes, developerCounts, developerCover } from "@/lib/site/developers/model";
import { programOptionsOf } from "@/lib/site/developers/programs";
import { developerSlugState, readSiteDeveloper, readSiteDevelopers } from "@/lib/site/developers/read";
import type { DeveloperPage } from "@/lib/site/developers/records";
import { pageMetadata, siteOrigin } from "@/lib/site/metadata";
import { developerLd } from "@/lib/site/seo/jsonLd";

// Адрес читается сразу, вне <Suspense>: чужой адрес отвечает настоящим 404 (как у страницы ЖК).
export const instant = false;

/** cacheComponents требует хотя бы один адрес: без облака — заглушка, она ответит «недоступна». */
const FALLBACK_SLUG = "zastroyshchik";

export async function generateStaticParams() {
  const developers = await readSiteDevelopers().catch(() => null);
  const slugs = (developers ?? []).map((developer) => ({ slug: developer.slug }));
  return slugs.length > 0 ? slugs : [{ slug: FALLBACK_SLUG }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/zastroyshchiki/[slug]">): Promise<Metadata> {
  const [{ slug }, localeRaw, t] = await Promise.all([params, getLocale(), getTranslations("developers.page")]);
  const locale = isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE;
  const result = await readSiteDeveloper(slug);
  if (result.kind !== "page") return { title: t("role") };
  const { page } = result;
  const catalog = await readSiteCatalog();
  const cover = developerCover(page, catalog ? developerComplexes(catalog, page.id) : []);
  return pageMetadata({
    locale,
    path: developerRoute(page.slug),
    title: t("metaTitle", { name: page.name }),
    description: t("metaDescription", { name: page.name }),
    image: cover
      ? {
          url: mediaPublicUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", cover.path),
          width: cover.width,
          height: cover.height,
          alt: page.name,
        }
      : undefined,
  });
}

/** Карточкам каталога на странице хватает курса и программ этого застройщика — без всего каталога в HTML. */
function catalogOf(catalog: SiteCatalog, page: DeveloperPage): SiteCatalog {
  return {
    rate: catalog.rate,
    developers: catalog.developers.filter((developer) => developer.id === page.id),
    complexes: developerComplexes(catalog, page.id),
  };
}

/**
 * Страница застройщика (шаг 3.15, мокап SiteDev / MobDev, ТЗ 8): статичная, обновляется по тегам
 * застройщика и каталога. Первый экран, «О компании» и «Проверено», объекты с вкладками, сданные
 * объекты, условия покупки, другие застройщики. Контактов застройщика нет (правило ТЗ 1.2).
 */
export default async function DeveloperPageRoute({ params }: PageProps<"/[locale]/zastroyshchiki/[slug]">) {
  const [{ slug }, messages, localeRaw] = await Promise.all([params, getMessages(), getLocale()]);
  const locale = (isLocale(localeRaw) ? localeRaw : DEFAULT_LOCALE) as Locale;
  const [result, t] = await Promise.all([readSiteDeveloper(slug), getTranslations("developers.page")]);
  if (result.kind === "missing") return goneOrNotFound(slug, locale);
  if (result.kind === "unavailable") {
    return (
      <>
        <SiteHeader backHref={ROUTES.developers} />
        <Container as="main">
          <p className="pt-36 pb-12 text-muted-foreground">{t("unavailable")}</p>
        </Container>
      </>
    );
  }
  const { page } = result;
  const [catalog, developers] = await Promise.all([readSiteCatalog(), readSiteDevelopers()]);
  const complexes = catalog ? developerComplexes(catalog, page.id) : [];
  const checks = developerChecks(page, complexes);
  const options = programOptionsOf(catalog?.developers.find((developer) => developer.id === page.id)?.programs ?? []);
  const others = (developers ?? [])
    .filter((developer) => developer.id !== page.id)
    .map((developer) => ({ ...developer, complexes: catalog ? developerComplexes(catalog, developer.id).length : 0 }));
  const consult: LeadIntent = { type: "consult", object: { developer: page.slug }, context: t("consultContext", { name: page.name }) };
  return (
    <NextIntlClientProvider messages={pickMessages(messages, DEVELOPERS_MESSAGES)}>
      <SiteHeader overPhoto transparentAtTop transparentOnPhoneOnly pageTitle={page.name} backHref={ROUTES.developers} />
      <main>
        <JsonLd data={developerLd({ origin: siteOrigin(), locale, page })} />
        <Container>
          <DeveloperHero page={page} cover={developerCover(page, complexes)} counts={developerCounts(complexes)} verified={checks.verified} consult={consult} />
          <DeveloperAbout page={page} checks={checks} locale={locale} />
          {catalog ? <DeveloperObjects catalog={catalogOf(catalog, page)} complexes={complexes} /> : null}
          <DeveloperDelivered projects={page.pastProjects} locale={locale} />
          <DeveloperPrograms options={options} developerSlug={page.slug} developerName={page.name} locale={locale} />
          <DeveloperOthers others={others} />
        </Container>
      </main>
    </NextIntlClientProvider>
  );
}

/** Застройщик в архиве — 307 на список (его могут восстановить); удалён или чужой адрес — 404. */
async function goneOrNotFound(slug: string, locale: Locale): Promise<never> {
  if ((await developerSlugState(slug)) === "archived") redirect(`/${locale}${ROUTES.developers}`);
  notFound();
}
