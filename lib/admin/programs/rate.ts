import { USD_UZS_RANGE } from "@/lib/rates/cbu";

// Ручной курс (Р6): «11 900» или «11 808,76» — разряды пробелами, копейки запятой или точкой.

export type RateInput = { value: number | null; issue?: "required" | "number" | "range" };

export function parseRateInput(raw: string): RateInput {
  const text = raw.replace(/\s+/g, "").replace(",", ".");
  if (!text) return { value: null, issue: "required" };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { value: null, issue: "number" };
  const value = Number(text);
  if (value < USD_UZS_RANGE.min || value > USD_UZS_RANGE.max)
    return { value: null, issue: "range" };
  return { value };
}
