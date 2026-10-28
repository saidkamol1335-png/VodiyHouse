import type { LocalizedText } from "@/lib/contacts";
import { complexRoute, ROUTES } from "@/lib/routes";
import { cardPrice, cheapest, type CardPrice } from "@/lib/site/catalog/card";
import { NO_FILTER, offerMatches, type CatalogFilter } from "@/lib/site/catalog/filter";
import { searchFromFilter } from "@/lib/site/catalog/params";
import { COLLECTION_PARAM } from "@/lib/site/catalog/pending";
import type { CatalogComplex, CatalogPhoto, SiteCatalog } from "@/lib/site/catalog/records";
import { filterCatalog } from "@/lib/site/catalog/sort";
import type { ShowcaseAd, ShowcaseCollection, ShowcaseSpecial, SiteShowcase } from "./records";

// Витрина на сайте (3.16б): всё считается из одного ответа каталога — страница статичная. Подборка
// вручную — список ЖК, по фильтру — фильтр каталога; у рекламы и спецпредложения цифры «в продаже»,
// «цена от» и «платёж от» — по их ЖК, как на карточках каталога (без скидок, PLAN §3.13).

export type ShowcaseCount = { complexes: number; flats: number; partial: boolean };

/** Адрес каталога с подборкой: /novostroyki?podborka=slug (решение «Решаю сам» 3б). */
export { COLLECTION_PARAM };

/** ЖК в карточках витрины — только то, что нужно чипам и ссылкам, а не весь каталог ещё раз. */
export type ShowcaseComplexRef = { id: string; slug: string; name: LocalizedText; location: LocalizedText | null };

const refOf = (complex: CatalogComplex): ShowcaseComplexRef => ({
  id: complex.id,
  slug: complex.slug,
  name: complex.name,
  location: complex.location?.name ?? null,
});

/** ЖК по списку руководителя в его порядке; снятые с сайта уже отфильтрованы базой. */
const byIds = (catalog: SiteCatalog, ids: readonly string[]) =>
  ids.flatMap((id) => catalog.complexes.filter((complex) => complex.id === id));

/** Куда ведёт карточка: один ЖК — его страница, несколько — подборка /podborka?zhk=… (3.10). */
export function complexesHref(complexes: readonly { slug: string }[]): string {
  if (complexes.length === 1) return complexRoute(complexes[0]!.slug);
  return `${ROUTES.podborka}?zhk=${complexes.map((complex) => complex.slug).join(",")}`;
}

/** ЖК подборки: вручную — по списку в порядке каталога, по фильтру — как в выдаче. */
export function collectionComplexes(catalog: SiteCatalog, collection: ShowcaseCollection): CatalogComplex[] {
  if (collection.mode === "manual") {
    return catalog.complexes.filter((complex) => collection.complexIds.includes(complex.id));
  }
  return filterCatalog(catalog, collection.filter);
}

/** Фильтр, который подборка ставит каталогу: вручную — пустой (выдачу ограничивает список ЖК). */
export function collectionFilter(collection: ShowcaseCollection): CatalogFilter {
  return collection.mode === "manual" ? NO_FILTER : collection.filter;
}

/** Выдача каталога с применённой подборкой: по фильтру — как обычно, вручную — только её ЖК. */
export function collectionResults(catalog: SiteCatalog, collection: ShowcaseCollection, filter: CatalogFilter): CatalogComplex[] {
  const found = filterCatalog(catalog, filter);
  return collection.mode === "manual" ? found.filter((complex) => collection.complexIds.includes(complex.id)) : found;
}

/** «?podborka=slug&komnat=2» — подборка первой, дальше параметры фильтра (как у ссылки менеджера). */
export function searchWithCollection(filter: CatalogFilter, slug: string | null): string {
  const search = searchFromFilter(filter);
  if (!slug) return search;
  const collection = `${COLLECTION_PARAM}=${slug}`;
  return search ? `?${collection}&${search.slice(1)}` : `?${collection}`;
}

export function collectionBySlug(collections: readonly ShowcaseCollection[], slug: string | null | undefined): ShowcaseCollection | null {
  return (slug && collections.find((collection) => collection.slug === slug)) || null;
}

/** Свободные квартиры подходящих типов; partial — у части наличие без списка (число «не меньше»). */
function countFlats(complexes: readonly CatalogComplex[], catalog: SiteCatalog, filter: CatalogFilter): Omit<ShowcaseCount, "complexes"> {
  let flats = 0;
  let partial = false;
  for (const complex of complexes) {
    for (const block of complex.blocks) {
      for (const offer of block.offers) {
        if (!offerMatches(offer, block.currency, filter, catalog.rate)) continue;
        if (offer.free === null) partial ||= offer.available;
        else flats += offer.free;
      }
    }
  }
  return { flats, partial };
}

/** «{n} ЖК · {f} квартир в продаже» на карточке подборки. */
export function collectionCount(catalog: SiteCatalog, collection: ShowcaseCollection): ShowcaseCount {
  const complexes = collectionComplexes(catalog, collection);
  return { complexes: complexes.length, ...countFlats(complexes, catalog, collectionFilter(collection)) };
}

/** Подборки с ЖК на сайте — пустая не показывается (решение 3б). */
export function visibleCollections(catalog: SiteCatalog, showcase: SiteShowcase): ShowcaseCollection[] {
  return showcase.collections.filter((collection) => collectionComplexes(catalog, collection).length > 0);
}

/** Обложка подборки, рекламы или спецпредложения без своего фото — обложка первого её ЖК. */
export function coverOf(cover: CatalogPhoto | null, complexes: readonly CatalogComplex[]): CatalogPhoto | null {
  return cover ?? complexes.find((complex) => complex.photos[0])?.photos[0] ?? null;
}

/** Самая низкая «цена от» среди ЖК — как на карточках каталога (через курс, Ф6). */
export function priceFromOf(catalog: SiteCatalog, complexes: readonly CatalogComplex[]): CardPrice | null {
  const prices = complexes.flatMap((complex) => {
    const price = cardPrice(complex, catalog);
    return price ? [price] : [];
  });
  return cheapest(prices, catalog.rate);
}

/** Дней до конца включительно: сегодня = последний день → 0. Даты ISO. */
export function daysLeft(validTo: string, today: string): number {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((Date.parse(validTo) - Date.parse(today)) / DAY_MS));
}

export type SpecialView = {
  special: ShowcaseSpecial;
  cover: CatalogPhoto | null;
  complexes: ShowcaseComplexRef[];
  price: CardPrice | null;
  href: string;
  daysLeft: number;
};

/** Карточка спецпредложения (мокап .spc): ЖК в порядке руководителя, «от $…» по самому дешёвому. */
export function specialView(catalog: SiteCatalog, special: ShowcaseSpecial, today: string): SpecialView | null {
  const complexes = byIds(catalog, special.complexIds);
  if (complexes.length === 0) return null;
  return {
    special,
    cover: coverOf(special.cover, complexes),
    complexes: complexes.map(refOf),
    price: priceFromOf(catalog, complexes),
    href: complexesHref(complexes),
    daysLeft: daysLeft(special.validTo, today),
  };
}

/** Спецпредложения с хотя бы одним ЖК на сайте, по порядку руководителя. */
export function visibleSpecials(catalog: SiteCatalog, showcase: SiteShowcase): SpecialView[] {
  return showcase.specials.flatMap((special) => {
    const view = specialView(catalog, special, showcase.today);
    return view ? [view] : [];
  });
}

export type AdView = {
  ad: ShowcaseAd;
  cover: CatalogPhoto | null;
  complexes: ShowcaseComplexRef[];
  count: ShowcaseCount;
  price: CardPrice | null;
  /** «Платёж от» — наименьший среди ЖК (в валюте цены «от» того же ЖК). */
  payment: CardPrice | null;
  /** Куда ведёт «Показать N квартир»: страница ЖК, подборка из нескольких или каталог с фильтром. */
  href: string;
};

/** Фильтр рекламы «по фильтру» — только ЖК своего застройщика: платная карточка не показывает чужие. */
export function adFilter(ad: ShowcaseAd): CatalogFilter {
  return { ...ad.filter, developers: [ad.developer.slug] };
}

function adViewOf(catalog: SiteCatalog, ad: ShowcaseAd): AdView | null {
  const byComplexes = ad.complexIds.length > 0;
  const complexes = byComplexes ? byIds(catalog, ad.complexIds) : filterCatalog(catalog, adFilter(ad));
  if (complexes.length === 0) return null;
  const filter = byComplexes ? NO_FILTER : adFilter(ad);
  const payments = complexes.flatMap((complex) => {
    const price = cardPrice(complex, catalog);
    return price?.payment ? [{ ...price, amount: price.payment }] : [];
  });
  return {
    ad,
    cover: coverOf(ad.cover, complexes),
    complexes: complexes.map(refOf),
    count: { complexes: complexes.length, ...countFlats(complexes, catalog, filter) },
    price: priceFromOf(catalog, complexes),
    payment: cheapest(payments, catalog.rate),
    href: byComplexes ? complexesHref(complexes) : `${ROUTES.catalog}${searchFromFilter(filter)}`,
  };
}

/** Первая действующая реклама по порядку руководителя (Г1 A) с цифрами; null — показывать нечего. */
export function adView(catalog: SiteCatalog, showcase: SiteShowcase): AdView | null {
  for (const ad of showcase.ads) {
    const view = adViewOf(catalog, ad);
    if (view) return view;
  }
  return null;
}

/** Бейдж спецпредложения на карточке ЖК: первое по порядку предложение с этим ЖК (ключ — id ЖК). */
export function cardBadges(showcase: SiteShowcase): Record<string, LocalizedText> {
  const badges: Record<string, LocalizedText> = {};
  for (const special of showcase.specials) {
    for (const id of special.complexIds) badges[id] ??= special.badge;
  }
  return badges;
}

/** «Подарок» на карточке цены ЖК — первое действующее предложение-подарок с этим ЖК. */
export function complexGift(showcase: SiteShowcase, complexId: string): ShowcaseSpecial | null {
  return showcase.specials.find((special) => special.kind === "gift" && special.complexIds.includes(complexId)) ?? null;
}
