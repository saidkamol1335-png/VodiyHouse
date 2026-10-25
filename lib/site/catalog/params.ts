import {
  CATALOG_SORTS,
  NO_FILTER,
  PAYMENT_KINDS,
  ROOM_CHIPS,
  type CatalogFilter,
  type CatalogSort,
  type DeadlineFilter,
  type PaymentKind,
} from "./filter";

// Фильтр каталога в адресе (Ф3: ссылка менеджера и «Поделиться» открываются сразу на результатах).
// Имена параметров — как в мокапе (filterQuery): komnat, gorod, ot, do, srok, oplata, zastr,
// otdelka, sort. Чужое значение молча пропускается: битая ссылка даёт каталог, а не ошибку.

type Search = Record<string, string | string[] | undefined>;

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_PRICE = 100_000_000;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";
const list = (value: string | string[] | undefined) => first(value).split(",").filter(Boolean);
const unique = <T,>(values: T[]) => [...new Set(values)];

function price(value: string | string[] | undefined): number | null {
  const amount = Number(first(value));
  return Number.isInteger(amount) && amount > 0 && amount <= MAX_PRICE ? amount : null;
}

function deadline(value: string | string[] | undefined): DeadlineFilter {
  const text = first(value);
  if (text === "built") return "built";
  const year = Number(text);
  return Number.isInteger(year) && year >= 2020 && year <= 2100 ? year : "any";
}

export function filterFromSearch(search: Search): CatalogFilter {
  const rooms = list(search.komnat).map(Number);
  const sort = first(search.sort);
  return {
    rooms: unique(rooms.filter((value) => (ROOM_CHIPS as readonly number[]).includes(value))).sort((a, b) => a - b),
    priceMin: price(search.ot),
    priceMax: price(search.do),
    locations: unique(list(search.gorod).filter((slug) => SLUG.test(slug))),
    developers: unique(list(search.zastr).filter((slug) => SLUG.test(slug))),
    deadline: deadline(search.srok),
    payments: unique(list(search.oplata).filter((kind): kind is PaymentKind => (PAYMENT_KINDS as readonly string[]).includes(kind))),
    finishings: unique(list(search.otdelka).filter((slug) => SLUG.test(slug))),
    sort: (CATALOG_SORTS as readonly string[]).includes(sort) ? (sort as CatalogSort) : NO_FILTER.sort,
  };
}

/** «?komnat=1,2&do=60000» — только заданное; пустой фильтр — пустая строка. */
export function searchFromFilter(filter: CatalogFilter): string {
  const params = new URLSearchParams();
  const put = (name: string, values: readonly (string | number)[]) => {
    if (values.length > 0) params.set(name, values.join(","));
  };
  put("komnat", filter.rooms);
  put("gorod", filter.locations);
  put("ot", filter.priceMin === null ? [] : [filter.priceMin]);
  put("do", filter.priceMax === null ? [] : [filter.priceMax]);
  put("srok", filter.deadline === "any" ? [] : [filter.deadline]);
  put("oplata", filter.payments);
  put("zastr", filter.developers);
  put("otdelka", filter.finishings);
  put("sort", filter.sort === NO_FILTER.sort ? [] : [filter.sort]);
  const query = params.toString().replace(/%2C/g, ",");
  return query ? `?${query}` : "";
}
