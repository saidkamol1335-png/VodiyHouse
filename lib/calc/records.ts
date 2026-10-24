import type { Currency, ExchangeRate } from "./money";
import type {
  CalcProgram,
  FeeName,
  OverMaxBehavior,
  ProgramMethod,
  ProgramType,
  TermsProgram,
} from "./programs";

// Записи базы (site_payment_programs, 20261024100000_payment_programs.sql) → программы lib/calc.
// Полей скидки в записи сайта нет вовсе (PLAN §3.13); кабинетные — lib/calc/cabinet/records.ts.

export type RateRecord = { usd_uzs: number; date: string; source: "cbu" | "manual" };
export type TermRecord = { months: number; rate_pct: number };
export type FeeRecord = { name: FeeName; kind: "fixed" | "pct"; value: number };
export type SiteTierRecord = { min_down_pct: number; min_months: number; max_months: number };
export type BilingualRecord = { ru: string; uz: string };

export type SiteProgramRecord = {
  id: string;
  type: ProgramType;
  method: ProgramMethod | null;
  bank: BilingualRecord | null;
  min_down_pct: number | null;
  tiers: SiteTierRecord[];
  terms: TermRecord[];
  fees: FeeRecord[];
  preset_months: number[];
  allow_custom_months: boolean;
  over_max_behavior: OverMaxBehavior;
  currency: Currency | null;
  blocks_scope: "all" | "selected";
  block_ids: string[];
  conditions: BilingualRecord | null;
  /** «Условия актуальны на» — позднее из правки и отметки «проверены» (Р5). */
  updated_at: string;
};

export type SiteProgramsRecord = {
  rate: RateRecord | null;
  developers: { id: string; slug: string; name: string; programs: SiteProgramRecord[] }[];
};

export function rateFromRecord(record: RateRecord | null): ExchangeRate | null {
  if (!record) return null;
  return { usdUzs: Number(record.usd_uzs), date: record.date, source: record.source };
}

/** Строки сроков и разовые — как в базе; числа приводятся явно (numeric приходит и строкой). */
function termsPart(record: SiteProgramRecord): Omit<TermsProgram, "type" | "method"> {
  return {
    minDownPct: Number(record.min_down_pct ?? 0),
    terms: record.terms.map((term) => ({
      months: Number(term.months),
      ratePct: Number(term.rate_pct),
    })),
    fees: record.fees.map((fee) => ({ name: fee.name, kind: fee.kind, value: Number(fee.value) })),
    currency: record.currency,
  };
}

export function programFromRecord(record: SiteProgramRecord): CalcProgram {
  if (record.type === "full") return { type: "full" };
  if (record.method === "tiers") {
    return {
      type: "installment",
      method: "tiers",
      tiers: record.tiers.map((tier) => ({
        minDownPct: Number(tier.min_down_pct),
        minMonths: Number(tier.min_months),
        maxMonths: Number(tier.max_months),
      })),
      presetMonths: record.preset_months.map(Number),
      allowCustomMonths: record.allow_custom_months,
      overMaxBehavior: record.over_max_behavior,
    };
  }
  // База не пропускает программу без метода (check_payment_program) — значит, запись чужая.
  if (record.method === null) throw new Error(`Программа ${record.id} без метода расчёта`);
  return { type: record.type, method: record.method, ...termsPart(record) };
}
