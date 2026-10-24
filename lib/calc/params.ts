import { CUSTOM_MONTHS_MAX } from "@/lib/format";
import type { Currency } from "./money";
import { DOWN_MAX_PCT } from "./programs";

// Адрес расчёта — одна схема ключей для кабинета и сайта (решение экранов 2.4–2.7): по ссылке
// открывается тот же расчёт. Чужое значение в адресе — как будто ключа нет, а не ошибка.

/** Откуда стоимость: квартира из наличия, площадь × цена м², планировка, сумма. */
export type PriceMode = "unit" | "area" | "layout" | "sum";
export const PRICE_MODES: readonly PriceMode[] = ["unit", "area", "layout", "sum"];

export type CalcParams = {
  developer: string | null;
  program: string | null;
  mode: PriceMode | null;
  unit: string | null;
  layout: string | null;
  /** Как набрано в поле («64,2», «31 000») — разбирает расчёт. */
  area: string | null;
  perM2: string | null;
  sum: string | null;
  downPct: number | null;
  months: number | null;
  /** Валюта ввода стоимости (Р7) и валюта итога (В9). */
  inCurrency: Currency | null;
  outCurrency: Currency | null;
};

export const EMPTY_CALC_PARAMS: CalcParams = {
  developer: null,
  program: null,
  mode: null,
  unit: null,
  layout: null,
  area: null,
  perM2: null,
  sum: null,
  downPct: null,
  months: null,
  inCurrency: null,
  outCurrency: null,
};

const KEYS = {
  developer: "developer",
  program: "program",
  mode: "mode",
  unit: "unit",
  layout: "layout",
  area: "area",
  perM2: "m2",
  sum: "sum",
  downPct: "down",
  months: "months",
  inCurrency: "in",
  outCurrency: "out",
} as const satisfies Record<keyof CalcParams, string>;

/** Ключи адреса, которые принадлежат расчёту; остальные (utm_*, ?plan=) расчёт не трогает. */
export const CALC_PARAM_KEYS: readonly string[] = Object.values(KEYS);

type Search = URLSearchParams | Record<string, string | string[] | undefined>;

function readRaw(search: Search, key: string): string | null {
  const value = search instanceof URLSearchParams ? search.get(key) : search[key];
  const text = Array.isArray(value) ? value[0] : value;
  // Предел от мусора в адресе, а не от длины slug (у застройщика он бывает и за 40 знаков).
  const trimmed = text?.trim().slice(0, 120);
  return trimmed ? trimmed : null;
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

/** Число, набранное в поле: цифры, пробелы, одна запятая или точка. */
const readNumberText = (search: Search, key: string) => {
  const raw = readRaw(search, key);
  return raw !== null && /^[\d\s]+([.,]\d+)?$/.test(raw) ? raw : null;
};

export function readCalcParams(search: Search): CalcParams {
  const mode = readRaw(search, KEYS.mode);
  return {
    developer: readRaw(search, KEYS.developer),
    program: readRaw(search, KEYS.program),
    mode: PRICE_MODES.find((item) => item === mode) ?? null,
    unit: readRaw(search, KEYS.unit),
    layout: readRaw(search, KEYS.layout),
    area: readNumberText(search, KEYS.area),
    perM2: readNumberText(search, KEYS.perM2),
    sum: readNumberText(search, KEYS.sum),
    downPct: readInteger(search, KEYS.downPct, 0, DOWN_MAX_PCT),
    months: readInteger(search, KEYS.months, 1, CUSTOM_MONTHS_MAX),
    inCurrency: readCurrency(search, KEYS.inCurrency),
    outCurrency: readCurrency(search, KEYS.outCurrency),
  };
}

/** Параметры → строка адреса без пустых ключей; порядок ключей постоянный. */
export function writeCalcParams(params: CalcParams): URLSearchParams {
  const search = new URLSearchParams();
  for (const [name, key] of Object.entries(KEYS) as [keyof CalcParams, string][]) {
    const value = params[name];
    if (value !== null && value !== "") search.set(key, String(value));
  }
  return search;
}
