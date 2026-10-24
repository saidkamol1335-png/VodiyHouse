import type { Currency } from "./money";

// Программы оплаты для расчёта (PLAN §6 payment_programs, решения фазы 2). Скидок здесь нет:
// на сайте их не бывает (PLAN §3.13), кабинет добавляет их в lib/calc/cabinet.

export type ProgramType = "full" | "installment" | "bank_installment" | "mortgage";
export type ProgramMethod = "tiers" | "markup" | "annuity" | "differentiated";
export type OverMaxBehavior = "block" | "suggest_tier" | "lead";
export type FeeName = "appraisal" | "commission" | "insurance";

/** Ступень схемы застройщика: с какого взноса и какие сроки. */
export type DownTier = { minDownPct: number; minMonths: number; maxMonths: number };

/** Строка сроков: наценка за весь срок (markup) или годовая ставка банка. */
export type TermRow = { months: number; ratePct: number };

/** Разовый платёж: сумма в валюте программы или % от суммы кредита. */
export type FeeRule = { name: FeeName; kind: "fixed" | "pct"; value: number };

export type FullPaymentProgram = { type: "full" };

/** Схема застройщика: правила сроков (PLAN §3б) есть только у неё. */
export type TieredProgram = {
  type: "installment";
  method: "tiers";
  tiers: readonly DownTier[];
  presetMonths: readonly number[];
  allowCustomMonths: boolean;
  overMaxBehavior: OverMaxBehavior;
};

/** Наценка застройщика и банки: сроки — строки, своего срока нет. */
export type TermsProgram = {
  type: Exclude<ProgramType, "full">;
  method: Exclude<ProgramMethod, "tiers">;
  minDownPct: number;
  terms: readonly TermRow[];
  fees: readonly FeeRule[];
  /** null — считается в валюте цены (программы застройщика). */
  currency: Currency | null;
};

export type CalcProgram = FullPaymentProgram | TieredProgram | TermsProgram;

/** Взнос выше — уже «100% оплата» отдельной программой (решение фазы 2). */
export const DOWN_MAX_PCT = 90;

/** Кнопки сроков, которые может включить руководитель (PLAN §3б). */
export const PRESET_MONTHS = [12, 24, 36, 48] as const;

export const isTiered = (program: CalcProgram): program is TieredProgram =>
  program.type !== "full" && program.method === "tiers";

export const isTermsProgram = (program: CalcProgram): program is TermsProgram =>
  program.type !== "full" && program.method !== "tiers";

/** Валюта расчёта: у банков — своя, у программ застройщика — валюта цены. */
export function programCurrency(program: CalcProgram, priceCurrency: Currency): Currency {
  return isTermsProgram(program) ? (program.currency ?? priceCurrency) : priceCurrency;
}

/** Минимальный взнос, %: у схемы — порог первой ступени. */
export function minDownOf(program: CalcProgram): number {
  if (program.type === "full") return 100;
  if (isTiered(program)) return program.tiers[0]?.minDownPct ?? 0;
  return program.minDownPct;
}

/** Самый длинный срок программы, мес. (у схемы — при минимальном взносе). */
export function maxMonthsOf(program: CalcProgram): number {
  if (program.type === "full") return 0;
  if (isTiered(program)) return program.tiers[0]?.maxMonths ?? 0;
  return program.terms.reduce((longest, row) => Math.max(longest, row.months), 0);
}

/** Вид программы в интерфейсе: тип и метод одним словом (кабинет, сайт, сравнение). */
export type ProgramKind = "full" | "scheme" | "markup" | "bank" | "mortgage";

export const PROGRAM_KINDS: readonly ProgramKind[] = [
  "full",
  "scheme",
  "markup",
  "bank",
  "mortgage",
];

export function kindOf(record: { type: ProgramType; method: ProgramMethod | null }): ProgramKind {
  if (record.type === "full") return "full";
  if (record.type === "installment") return record.method === "markup" ? "markup" : "scheme";
  return record.type === "mortgage" ? "mortgage" : "bank";
}
