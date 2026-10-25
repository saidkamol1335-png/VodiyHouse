import type { MetadataRoute } from "next";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/i18n/routing";
import { complexRoute, ROUTES } from "@/lib/routes";
import { localizedPath } from "@/lib/site/metadata";

// Карта сайта (шаг 3.14): страницы для поиска на обоих языках с парой hreflang и x-default.
// Избранное и подборка — без индексации (их нет и здесь); ЖК — только опубликованные из каталога:
// архивный или удалённый выпадает сам (3.13).

/** Страницы сайта в карте — те, что в поиске; порядок — как в шапке и подвале. */
export const SITEMAP_ROUTES = [
  ROUTES.home,
  ROUTES.catalog,
  ROUTES.calculator,
  ROUTES.about,
  ROUTES.forDevelopers,
  ROUTES.howToBuy,
  ROUTES.privacy,
] as const;

const PRIORITY: Partial<Record<string, number>> = { [ROUTES.home]: 1, [ROUTES.catalog]: 0.9 };
const COMPLEX_PRIORITY = 0.8;
const PAGE_PRIORITY = 0.5;

/** Одна страница — строка на каждый язык, у каждой — все языки и x-default. */
function entriesOf(origin: string, path: string, priority: number): MetadataRoute.Sitemap {
  const url = (locale: (typeof LOCALES)[number]) => `${origin}${localizedPath(locale, path)}`;
  const languages = { ...Object.fromEntries(LOCALES.map((locale) => [locale, url(locale)])), "x-default": url(DEFAULT_LOCALE) };
  return LOCALES.map((locale) => ({ url: url(locale), priority, alternates: { languages } }));
}

export function buildSitemap(origin: string, complexSlugs: readonly string[]): MetadataRoute.Sitemap {
  return [
    ...SITEMAP_ROUTES.flatMap((path) => entriesOf(origin, path, PRIORITY[path] ?? PAGE_PRIORITY)),
    ...complexSlugs.flatMap((slug) => entriesOf(origin, complexRoute(slug), COMPLEX_PRIORITY)),
  ];
}
