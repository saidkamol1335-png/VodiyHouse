// Деньги расчёта: валюта, курс, шаг вывода. Считаем без округления — округляет только вывод
// (PLAN §0.10, §7 фаза 2): USD — до доллара, сум — до тысячи.

export type Currency = "USD" | "UZS";

/** Курс: сколько сумов за доллар и на какую дату; ручной (Р6) подписывается без «ЦБ». */
export type ExchangeRate = { usdUzs: number; date: string; source: "cbu" | "manual" };

export const MONEY_STEP: Readonly<Record<Currency, number>> = { USD: 1, UZS: 1000 };

/** Сумма, округлённая шагом вывода своей валюты. */
export function roundMoney(amount: number, currency: Currency): number {
  const step = MONEY_STEP[currency];
  return Math.round(amount / step) * step;
}

/** Пересчёт по курсу; null — валюты разные, а курса нет. */
export function convertMoney(
  amount: number,
  from: Currency,
  to: Currency,
  rate: ExchangeRate | null,
): number | null {
  if (from === to) return amount;
  if (!rate || !(rate.usdUzs > 0)) return null;
  return from === "USD" ? amount * rate.usdUzs : amount / rate.usdUzs;
}
