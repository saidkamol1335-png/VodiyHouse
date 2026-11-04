import type { Currency } from "./money";
import { REALTOR_LIMITS, REALTOR_MODES, type RealtorMethod, type RealtorMode } from "./realtor";

// Адрес риелторского калькулятора (PLAN §10, п. 48): по ссылке открывается тот же расчёт. Ключи
// цены и валют — как у калькулятора квартиры (sum, area, m2, in, out); взнос — суммой в «first»,
// потому что старый «down» был процентом. Чужое значение — как будто ключа нет.

export type RealtorPriceMode = "sum" | "area";

export type RealtorParams = {
  tab: RealtorMode | null;
  priceMode: RealtorPriceMode | null;
  /** Как набрано в поле («600 000 000», «64,2»). */
  sum: string | null;
  area: string | null;
  perM2: string | null;
  first: string | null;
  monthly: string | null;
  years: number | null;
  months: number | null;
  rate: string | null;
  method: RealtorMethod | null;
  markup: string | null;
  inCurrency: Currency | null;
  outCurrency: Currency | null;
};

export const EMPTY_REALTOR_PARAMS: RealtorParams = {
  tab: null,
  priceMode: null,
  sum: null,
  area: null,
  perM2: null,
  first: null,
  monthly: null,
  years: null,
  months: null,
  rate: null,
  method: null,
  markup: null,
  inCurrency: null,
  outCurrency: null,
};

const KEYS = {
  tab: "tab",
  priceMode: "price",
  sum: "sum",
  area: "area",
  perM2: "m2",
  first: "first",
  monthly: "monthly",
  years: "years",
  months: "months",
  rate: "rate",
  method: "method",
  markup: "markup",
  inCurrency: "in",
  outCurrency: "out",
} as const satisfies Record<keyof RealtorParams, string>;

export const REALTOR_PARAM_KEYS: readonly string[] = Object.values(KEYS);

type Search = URLSearchParams | Record<string, string | string[] | undefined>;

function readRaw(search: Search, key: string): string | null {
  const value = search instanceof URLSearchParams ? search.get(key) : search[key];
  const text = Array.isArray(value) ? value[0] : value;
  const trimmed = text?.trim().slice(0, 40);
  return trimmed ? trimmed : null;
}

function readOne<T extends string>(search: Search, key: string, allowed: readonly T[]): T | null {
  const raw = readRaw(search, key);
  return allowed.find((item) => item === raw) ?? null;
}

function readInteger(search: Search, key: string, min: number, max: number): number | null {
  const raw = readRaw(search, key);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= min && value <= max ? value : null;
}

const readCurrency = (search: Search, key: string): Currency | null => {
  const raw = readRaw(search, key)?.toUpperCase();
  return raw === "USD" || raw === "UZS" ? raw : null;
};

/**
 * Число, набранное в поле: цифры, пробелы, запятые и точки (разряды или дробь — разберёт поле).
 * Ключ есть, а значение пустое — поле очистили: "" (иначе вернулось бы значение по умолчанию).
 */
const readNumberText = (search: Search, key: string) => {
  const present = search instanceof URLSearchParams ? search.has(key) : search[key] !== undefined;
  const raw = readRaw(search, key);
  if (raw === null) return present ? "" : null;
  return /^\d[\d\s]*([.,]\d+)*[.,]?$/.test(raw) ? raw : null;
};

export function readRealtorParams(search: Search): RealtorParams {
  const { years, months } = REALTOR_LIMITS;
  return {
    tab: readOne(search, KEYS.tab, REALTOR_MODES),
    priceMode: readOne(search, KEYS.priceMode, ["sum", "area"] as const),
    sum: readNumberText(search, KEYS.sum),
    area: readNumberText(search, KEYS.area),
    perM2: readNumberText(search, KEYS.perM2),
    first: readNumberText(search, KEYS.first),
    monthly: readNumberText(search, KEYS.monthly),
    years: readInteger(search, KEYS.years, years.min, years.max),
    months: readInteger(search, KEYS.months, months.min, months.max),
    rate: readNumberText(search, KEYS.rate),
    method: readOne(search, KEYS.method, ["annuity", "differentiated"] as const),
    markup: readNumberText(search, KEYS.markup),
    inCurrency: readCurrency(search, KEYS.inCurrency),
    outCurrency: readCurrency(search, KEYS.outCurrency),
  };
}

/** Параметры → строка адреса; null — ключа нет, "" — очищенное поле («first=»); порядок постоянный. */
export function writeRealtorParams(params: RealtorParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS) as [keyof RealtorParams, string][]) {
    const value = params[name];
    if (value !== null) search.set(key, String(value));
  }
  return search;
}
