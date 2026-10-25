import { getTranslations } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { mediaPublicUrl } from "@/lib/media";
import { complexRoute, ROUTES } from "@/lib/routes";
import type { ComplexPage } from "@/lib/site/complex/model";
import { complexSummary } from "@/lib/site/complex/summary";
import { localizedPath, SITE_NAME, siteOrigin } from "@/lib/site/metadata";
import { breadcrumbLd, complexLd } from "@/lib/site/seo/jsonLd";

// Поиск и превью ссылки страницы ЖК (шаг 3.14): описание с ценой «от» — одно для <meta>, Open Graph
// и schema.org; разметка ЖК и крошек.

/** Фото для поиска — первые три: обложка и ещё два ракурса. */
const LD_PHOTOS = 3;

type Translate = Awaited<ReturnType<typeof getTranslations<"complex">>>;

/** «ЖК Shodlik · Фергана — квартиры от $31 000: наличие квартир, цены…». */
export function complexDescription(t: Translate, page: ComplexPage, locale: Locale): string {
  const place = page.location?.name[locale];
  const price = complexSummary(page).price;
  return t("metaDescription", {
    name: page.name[locale],
    place: place ? t("metaPlace", { place }) : "",
    price: price ? t("metaPrice", { price: formatPrice(price.amount, price.currency, locale) }) : "",
  });
}

/** schema.org страницы ЖК: сам ЖК с ценой «от» и крошки «Vodiy House › Новостройки › ЖК». */
export async function ComplexJsonLd({ page, locale }: { page: ComplexPage; locale: Locale }) {
  const [t, tNav] = await Promise.all([getTranslations("complex"), getTranslations("nav")]);
  const origin = siteOrigin();
  const url = `${origin}${localizedPath(locale, complexRoute(page.slug))}`;
  const name = t("name", { name: page.name[locale] });
  const summary = complexSummary(page);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const complex = complexLd({
    origin,
    url,
    name,
    description: complexDescription(t, page, locale),
    address: page.address?.[locale] ?? null,
    point: page.point,
    images: page.photos.slice(0, LD_PHOTOS).map((photo) => mediaPublicUrl(supabaseUrl, photo.path)),
    price: summary.price,
    free: summary.free,
  });
  const crumbs = breadcrumbLd([
    { name: SITE_NAME, url: `${origin}${localizedPath(locale, ROUTES.home)}` },
    { name: tNav("new"), url: `${origin}${localizedPath(locale, ROUTES.catalog)}` },
    { name, url },
  ]);
  return <JsonLd data={[complex, crumbs]} />;
}
