import type { CabinetTieredProgram, CabinetFullProgram } from "./cabinet/discounts";
import type { ExchangeRate } from "./money";
import type { TermsProgram } from "./programs";

// Программы мокапа (Main.dc.html, PROGS) — вымышленные DEMO-условия для тестов lib/calc.
// Кнопки сроков — по PLAN (подмножество 12/24/36/48, без 18 мокапа), минимальный срок — 1 мес.

/** Курс мокапа на 01.10.2026: с ним сходятся все числа экранов. */
export const MOCKUP_RATE: ExchangeRate = { usdUzs: 11808.76, date: "2026-10-01", source: "cbu" };

const tier = (minDownPct: number, discountPct: number, maxMonths: number) => ({
  minDownPct,
  discountPct,
  minMonths: 1,
  maxMonths,
});

/** Farg‘ona Sifat Qurilish (Shodlik) — tiers тестов PLAN §7. */
export const SIFAT_FULL: CabinetFullProgram = { type: "full", discountPct: 12 };
export const SIFAT_SCHEME: CabinetTieredProgram = {
  type: "installment",
  method: "tiers",
  tiers: [tier(30, 0, 36), tier(50, 6, 18), tier(70, 9, 12)],
  presetMonths: [12, 24, 36, 48],
  allowCustomMonths: true,
  overMaxBehavior: "block",
};
export const SIFAT_IPOTEKA_INSTALLMENT: TermsProgram = {
  type: "bank_installment",
  method: "annuity",
  minDownPct: 20,
  terms: [
    { months: 12, ratePct: 16 },
    { months: 24, ratePct: 18 },
  ],
  fees: [
    { name: "appraisal", kind: "fixed", value: 1_500_000 },
    { name: "commission", kind: "pct", value: 1 },
  ],
  currency: "UZS",
};
export const SIFAT_IPOTEKA_MORTGAGE: TermsProgram = {
  type: "mortgage",
  method: "annuity",
  minDownPct: 25,
  terms: [60, 120, 180].map((months) => ({ months, ratePct: 17.5 })),
  fees: [
    { name: "appraisal", kind: "fixed", value: 1_500_000 },
    { name: "insurance", kind: "pct", value: 0.5 },
  ],
  currency: "UZS",
};

/** Marg‘ilon Invest — tiers примера PLAN §3б, дифференцированный банк. */
export const MARGILAN_FULL: CabinetFullProgram = { type: "full", discountPct: 10 };
export const MARGILAN_SCHEME: CabinetTieredProgram = {
  ...SIFAT_SCHEME,
  tiers: [tier(40, 0, 36), tier(60, 5, 24), tier(80, 8, 12)],
};
export const MARGILAN_IPAK_INSTALLMENT: TermsProgram = {
  type: "bank_installment",
  method: "differentiated",
  minDownPct: 25,
  terms: [
    { months: 12, ratePct: 15 },
    { months: 24, ratePct: 16 },
    { months: 36, ratePct: 17 },
  ],
  fees: [{ name: "commission", kind: "pct", value: 1 }],
  currency: "UZS",
};
export const MARGILAN_IPAK_MORTGAGE: TermsProgram = {
  type: "mortgage",
  method: "annuity",
  minDownPct: 20,
  terms: [120, 180, 240].map((months) => ({ months, ratePct: 18 })),
  fees: [{ name: "appraisal", kind: "fixed", value: 1_200_000 }],
  currency: "UZS",
};

/** Kamalak Development — короткая схема (до 18 мес.). */
export const KAMALAK_SCHEME: CabinetTieredProgram = {
  ...SIFAT_SCHEME,
  tiers: [tier(30, 0, 18), tier(50, 5, 12)],
};
