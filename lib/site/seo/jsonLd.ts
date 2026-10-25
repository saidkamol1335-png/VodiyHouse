import type { Currency } from "@/lib/calc/money";
import type { SiteContacts } from "@/lib/contacts";
import type { Locale } from "@/lib/i18n/routing";
import { SITE_NAME } from "@/lib/site/metadata";

// schema.org для поиска (шаг 3.14): агентство — на главной, ЖК с ценой «от» и крошками — на странице
// ЖК. Контакты — только Vodiy House (правило ТЗ 1.2): у ЖК нет ни телефона, ни сайта застройщика.

export type JsonLd = Record<string, unknown>;

const CONTEXT = "https://schema.org";
const REGION: Record<Locale, string> = { ru: "Ферганская область", uz: "Farg‘ona viloyati" };
const CITY: Record<Locale, string> = { ru: "Фергана", uz: "Farg‘ona" };

/** Агентство: название, адрес офиса, где работает; телефон и соцсети — только введённые (Ф9). */
export function agencyLd(input: { origin: string; locale: Locale; office: string; contacts: SiteContacts }): JsonLd {
  const { origin, locale, office, contacts } = input;
  const profiles = [
    contacts.telegram ? `https://t.me/${contacts.telegram}` : null,
    contacts.instagram ? `https://www.instagram.com/${contacts.instagram}` : null,
  ].filter((url): url is string => url !== null);
  return {
    "@context": CONTEXT,
    "@type": "RealEstateAgent",
    name: SITE_NAME,
    url: `${origin}/${locale}`,
    logo: `${origin}/icon.svg`,
    image: `${origin}/${locale}/opengraph-image`,
    address: { "@type": "PostalAddress", streetAddress: office, addressLocality: CITY[locale], addressRegion: REGION[locale], addressCountry: "UZ" },
    areaServed: { "@type": "AdministrativeArea", name: REGION[locale] },
    ...(contacts.phone ? { telephone: contacts.phone } : {}),
    ...(profiles.length > 0 ? { sameAs: profiles } : {}),
  };
}

export type ComplexLdInput = {
  origin: string;
  /** Абсолютный адрес страницы ЖК на её языке. */
  url: string;
  name: string;
  description: string;
  address: string | null;
  point: { lat: number; lng: number } | null;
  images: string[];
  price: { amount: number; currency: Currency } | null;
  /** Свободных квартир; null — число неизвестно. */
  free: number | null;
};

/**
 * ЖК — ApartmentComplex; с ценой ещё и Product: у Place нет «offers», а цена «от» — главное в
 * выдаче. Цена — минимальная из свободных квартир, в валюте блока (как на карточке, Ф6).
 */
export function complexLd(input: ComplexLdInput): JsonLd {
  const { url, name, description, address, point, images, price, free } = input;
  return {
    "@context": CONTEXT,
    "@type": price ? ["ApartmentComplex", "Product"] : "ApartmentComplex",
    name,
    description,
    url,
    ...(images.length > 0 ? { image: images } : {}),
    ...(address ? { address: { "@type": "PostalAddress", streetAddress: address, addressCountry: "UZ" } } : {}),
    ...(point ? { geo: { "@type": "GeoCoordinates", latitude: point.lat, longitude: point.lng } } : {}),
    ...(free !== null ? { numberOfAvailableAccommodationUnits: free } : {}),
    ...(price
      ? {
          offers: {
            "@type": "AggregateOffer",
            lowPrice: price.amount,
            priceCurrency: price.currency,
            availability: free === 0 ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            ...(free ? { offerCount: free } : {}),
            seller: { "@type": "RealEstateAgent", name: SITE_NAME, url: input.origin },
          },
        }
      : {}),
  };
}

/** Хлебные крошки: «Главная › Новостройки › ЖК …» — адреса абсолютные. */
export function breadcrumbLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })),
  };
}

/** JSON внутри <script>: «<» экранируем — текст из базы не закроет тег и не вставит разметку. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
