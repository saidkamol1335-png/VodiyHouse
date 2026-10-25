import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/routing";

// Метаданные публичных страниц (фаза 3, «Индексация»): canonical без параметров, hreflang uz / ru
// + x-default, Open Graph для превью ссылок в Telegram. Каждая страница сайта зовёт pageMetadata —
// так ни одна не останется без canonical и пары на другом языке.

export const SITE_NAME = "Vodiy House";
const PRODUCTION_ORIGIN = "https://vodiyhouse.uz";

type Env = Record<string, string | undefined>;

/**
 * Адрес сайта для абсолютных ссылок (canonical, og:url, og:image) — вшивается при сборке: SITE_URL —
 * если задан (на боевом сайте — обязательно: URL Netlify может быть ещё *.netlify.app); на Netlify —
 * URL основного адреса сайта (тестовый деплой); иначе — боевой домен.
 */
export function siteOrigin(env: Env = process.env): string {
  // || , а не ??: пустая переменная окружения — как не заданная (new URL("") уронил бы все страницы).
  return (env.SITE_URL || env.URL || PRODUCTION_ORIGIN).replace(/\/+$/, "");
}

const OG_LOCALE: Record<Locale, string> = { ru: "ru_RU", uz: "uz_UZ" };

/** «/» → «/ru», «/kalkulyator» → «/ru/kalkulyator». */
export function localizedPath(locale: Locale, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

export type PageImage = { url: string; width: number; height: number; alt: string };

/**
 * Версия картинки превью: Telegram и Facebook кэшируют превью по адресу — после смены её дизайна
 * поднять номер, иначе ссылки покажут старую.
 */
const PREVIEW_VERSION = 1;

/** Картинка превью сайта — app/[locale]/opengraph-image.tsx (1200 × 630). */
export function defaultImage(locale: Locale): PageImage {
  return { url: `/${locale}/opengraph-image?v=${PREVIEW_VERSION}`, width: 1200, height: 630, alt: SITE_NAME };
}

export type PageMetaInput = {
  locale: Locale;
  /** Путь без языка и без параметров: «/», «/kalkulyator», «/zhk/shodlik». */
  path: string;
  title: string;
  description: string;
  /** Без своей — картинка превью сайта (defaultImage). */
  image?: PageImage;
  /** Страница не для поиска (/podborka, /izbrannoe) — ссылкой делятся, но в выдачу она не идёт. */
  noindex?: boolean;
};

export function pageMetadata({ locale, path, title, description, image, noindex }: PageMetaInput): Metadata {
  const languages = Object.fromEntries(LOCALES.map((code) => [code, localizedPath(code, path)]));
  return {
    title,
    description,
    alternates: {
      canonical: localizedPath(locale, path),
      languages: { ...languages, "x-default": localizedPath(DEFAULT_LOCALE, path) },
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: localizedPath(locale, path),
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALES.filter((code) => code !== locale).map((code) => OG_LOCALE[code]),
      // Свой openGraph страницы затирает картинку opengraph-image раздела — ставим её явно.
      images: [image ?? defaultImage(locale)],
    },
    twitter: { card: "summary_large_image", title, description, images: [(image ?? defaultImage(locale)).url] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
