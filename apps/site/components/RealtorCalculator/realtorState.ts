import { type Currency, convertMoney, type ExchangeRate, roundMoney } from "@vh/shared/calc/money";
import type { RealtorMethod, RealtorMode } from "@vh/shared/calc/realtor";
import type { RealtorParams, RealtorPriceMode } from "@vh/shared/calc/realtorParams";
import { formatAmount } from "@vh/shared/format";

// Состояние риелторского калькулятора (PLAN §10, п. 48): поля как набраны, адрес, валюта ввода.

export type RealtorState = {
  tab: RealtorMode;
  priceMode: RealtorPriceMode;
  sum: string;
  area: string;
  perM2: string;
  first: string;
  monthly: string;
  years: number;
  months: number;
  rate: string;
  method: RealtorMethod;
  markup: string;
  inCurrency: Currency;
  outCurrency: Currency;
};

/**
 * Старт без адреса: квартира 60 м² за 600 млн сум, взнос 20 %, ипотека на 15 лет. Ставка 17,5 % —
 * нижняя граница ипотеки на первичном рынке у банков Узбекистана в 2026 году (uysot.uz, 04.11);
 * посетитель меняет её на ставку своего банка.
 */
export const REALTOR_DEFAULTS: RealtorState = {
  tab: "mortgage",
  priceMode: "sum",
  sum: formatAmount(600_000_000),
  area: "60",
  perM2: formatAmount(10_000_000),
  first: formatAmount(120_000_000),
  monthly: formatAmount(8_000_000),
  years: 15,
  months: 24,
  rate: formatAmount(17.5),
  method: "annuity",
  markup: "0",
  inCurrency: "UZS",
  outCurrency: "UZS",
};

/** Те же суммы в долларах — ссылка с in=USD без части сумм не получит $120 000 000 взноса. */
const USD_AMOUNTS = {
  sum: formatAmount(50_000),
  perM2: formatAmount(800),
  first: formatAmount(10_000),
  monthly: formatAmount(650),
};

/** Поля-числа: из адреса — как в поле, с разрядами («600000000» → «600 000 000», «17.5» → «17,5»). */
const DECIMAL_FIELDS = ["area", "rate", "markup"] as const;
const MONEY_FIELDS = ["sum", "perM2", "first", "monthly"] as const;

/** Ключей нет в адресе — значения по умолчанию (в валюте ввода из адреса); пустой ключ — пустое поле. */
export function stateFrom(params: RealtorParams): RealtorState {
  const state: RealtorState =
    params.inCurrency === "USD"
      ? { ...REALTOR_DEFAULTS, ...USD_AMOUNTS, inCurrency: "USD", outCurrency: "USD" }
      : { ...REALTOR_DEFAULTS };
  for (const key of Object.keys(state) as (keyof RealtorState)[]) {
    const value = params[key];
    if (value !== null) Object.assign(state, { [key]: value });
  }
  for (const key of MONEY_FIELDS) state[key] = formatTyped(state[key]);
  for (const key of DECIMAL_FIELDS) state[key] = formatTyped(state[key], true);
  return state;
}

/** Числа в адрес — без пробелов, с точкой: «600000000», «17.5»; пустое поле — пустой ключ, не значение по умолчанию. */
export function paramsOf(state: RealtorState): RealtorParams {
  const clean = (text: string) => {
    const value = parseNumber(text);
    return value === null ? text.replace(/\s/g, "") : String(value);
  };
  const money = (text: string) => {
    const value = parseAmount(text);
    return value === null ? text.replace(/\s/g, "") : String(value);
  };
  return {
    tab: state.tab,
    priceMode: state.priceMode,
    sum: money(state.sum),
    area: clean(state.area),
    perM2: money(state.perM2),
    first: money(state.first),
    monthly: money(state.monthly),
    years: state.years,
    months: state.months,
    rate: clean(state.rate),
    method: state.method,
    markup: clean(state.markup),
    inCurrency: state.inCurrency,
    outCurrency: state.outCurrency,
  };
}

/** Число из поля: «17,5», «42.5», «0»; «17,» — пока набирают — 17; пусто или не число — null. */
export function parseNumber(text: string): number | null {
  const clean = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d*)?$/.test(clean)) return null;
  return Number(clean);
}

/** Сумма: ещё и разряды запятой или точкой — «65,000», «1.200.000» (а не 65 и 1,2). */
export function parseAmount(text: string): number | null {
  const clean = text.replace(/\s/g, "");
  if (/^\d{1,3}([.,]\d{3})+$/.test(clean)) return Number(clean.replace(/[.,]/g, ""));
  return parseNumber(clean);
}

/** Как показать число в поле после ввода: разряды и запятая — «600 000 000», «17,5». */
export const formatTyped = (text: string, decimal = false) => {
  const value = decimal ? parseNumber(text) : parseAmount(text);
  return value === null ? text : formatAmount(value);
};

/**
 * Валюта ввода сменилась: суммы в полях — по курсу, шагом новой валюты (иначе 600 000 000 сум
 * стали бы $600 000 000). Без курса переключателя нет.
 */
export function switchCurrency(state: RealtorState, to: Currency, rate: ExchangeRate | null): RealtorState {
  if (to === state.inCurrency) return state;
  const convert = (text: string) => {
    const value = parseAmount(text);
    const converted = value === null ? null : convertMoney(value, state.inCurrency, to, rate);
    return converted === null ? text : formatAmount(roundMoney(converted, to));
  };
  return {
    ...state,
    inCurrency: to,
    outCurrency: to,
    sum: convert(state.sum),
    perM2: convert(state.perM2),
    first: convert(state.first),
    monthly: convert(state.monthly),
  };
}
