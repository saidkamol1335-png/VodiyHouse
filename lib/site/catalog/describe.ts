import { formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import type { CatalogFilter, PaymentKind } from "./filter";
import type { SiteCatalog } from "./records";

// Фильтр каталога словами — плашка окна «Подберём вручную» и текст заявки «Подбор» для менеджера
// («komnat 2, do 60000» из адреса менеджеру не читается — «Полировка», блок D). Подписи — из
// messages каталога (их собирает вызывающий), названия района, застройщика и отделки — из
// каталога; не нашлось — slug как есть.

export type FilterLabels = {
  rooms: string;
  studio: string;
  price: string;
  priceFrom: string;
  priceTo: string;
  location: string;
  payment: string;
  payments: Record<PaymentKind, string>;
  deadline: string;
  deadlineBuilt: string;
  deadlineUpTo: (year: number) => string;
  developer: string;
  finishing: string;
};

const named = (slugs: readonly string[], names: Map<string, string>) =>
  slugs.map((slug) => names.get(slug) ?? slug).join(", ");

function priceRange(filter: CatalogFilter, labels: FilterLabels): string {
  const from = filter.priceMin === null ? null : `${labels.priceFrom} ${formatPrice(filter.priceMin, "USD")}`;
  const to = filter.priceMax === null ? null : `${labels.priceTo} ${formatPrice(filter.priceMax, "USD")}`;
  return [from, to].filter(Boolean).join(" ");
}

function deadlineText(filter: CatalogFilter, labels: FilterLabels): string {
  if (filter.deadline === "any") return "";
  return filter.deadline === "built" ? labels.deadlineBuilt : labels.deadlineUpTo(filter.deadline);
}

const locationNames = (catalog: SiteCatalog, locale: Locale) =>
  new Map(catalog.complexes.flatMap((c) => (c.location ? [[c.location.slug, c.location.name[locale]] as const] : [])));

const finishingNames = (catalog: SiteCatalog, locale: Locale) =>
  new Map(
    catalog.complexes.flatMap((c) =>
      c.blocks.flatMap((b) => (b.finishing ? [[b.finishing.slug, b.finishing.name[locale]] as const] : [])),
    ),
  );

/**
 * «Комнаты: 2, 3 · Цена квартиры, $: от $40 000 до $60 000 · Способ оплаты: Рассрочка · Срок сдачи:
 * до 2027». Пустой фильтр — пустая строка.
 */
export function describeFilter(filter: CatalogFilter, catalog: SiteCatalog, labels: FilterLabels, locale: Locale): string {
  const parts: string[] = [];
  const add = (label: string, value: string) => {
    if (value) parts.push(`${label}: ${value}`);
  };
  const room = (rooms: number) => (rooms === 0 ? labels.studio : rooms === 4 ? "4+" : String(rooms));
  add(labels.rooms, filter.rooms.map(room).join(", "));
  add(labels.price, priceRange(filter, labels));
  add(labels.location, named(filter.locations, locationNames(catalog, locale)));
  add(labels.payment, filter.payments.map((kind) => labels.payments[kind]).join(", "));
  add(labels.deadline, deadlineText(filter, labels));
  add(labels.developer, named(filter.developers, new Map(catalog.developers.map((d) => [d.slug, d.name]))));
  add(labels.finishing, named(filter.finishings, finishingNames(catalog, locale)));
  return parts.join(" · ");
}
