import { bilingualIssue, bilingualOrNull } from "../bilingual";
import { bilingualHasContact } from "../contactGuard";
import { parsePriceInput } from "@/lib/format";
import { typeAndMethod, type ProgramDraft, type TermDraft, type TierDraft } from "./draft";
import type { ProgramFieldErrors } from "./types";

// Проверка черновика до базы — те же правила, что у private.payment_program_problem
// (20261024100000_payment_programs.sql): ошибка — под своим полем, база остаётся последней защитой.

export const PROGRAM_LIMITS = { tiers: 8, terms: 12, fees: 5, conditionsMax: 300 } as const;

export type ProgramPayload = {
  id?: string;
  developer_id: string;
  bank_id: number | null;
  type: string;
  method: string | null;
  discount_pct: number | null;
  min_down_pct: number | null;
  tiers: { min_down_pct: number; discount_pct: number; min_months: number; max_months: number }[];
  terms: { months: number; rate_pct: number }[];
  fees: { name: string; kind: string; value: number }[];
  preset_months: number[];
  allow_custom_months: boolean;
  over_max_behavior: string;
  currency: string | null;
  blocks_scope: string;
  block_ids: string[];
  conditions: { ru: string; uz: string } | null;
};

type NumberIssue = "required" | "number" | "integer" | "range";

/** Процент: целый или с запятой («17,5»); вне пределов — ошибка. */
function percent(raw: string, max: number, integer: boolean): number | NumberIssue {
  const value = raw.trim().replace(",", ".");
  if (!value) return "required";
  if (!/^\d+(\.\d+)?$/.test(value)) return "number";
  const parsed = Number(value);
  if (integer && !Number.isInteger(parsed)) return "integer";
  return parsed >= 0 && parsed <= max ? parsed : "range";
}

/** Месяцы: целое 1–600. */
function months(raw: string): number | NumberIssue {
  const value = raw.trim();
  if (!value) return "required";
  if (!/^\d+$/.test(value)) return "number";
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 600 ? parsed : "range";
}

type Checker = (field: string, result: number | string) => number;

function checker(errors: ProgramFieldErrors): Checker {
  return (field, result) => {
    if (typeof result === "number") return result;
    errors[field] = result;
    return Number.NaN;
  };
}

function checkTiers(tiers: readonly TierDraft[], check: Checker, errors: ProgramFieldErrors) {
  if (tiers.length === 0) errors.tiers = "required";
  let previous = -1;
  return tiers.map((tier, index) => {
    const at = (name: string) => `tiers.${index}.${name}`;
    const minDown = check(at("minDownPct"), percent(tier.minDownPct, 90, true));
    const discount = check(at("discountPct"), percent(tier.discountPct, 50, false));
    const min = check(at("minMonths"), months(tier.minMonths));
    const max = check(at("maxMonths"), months(tier.maxMonths));
    if (minDown <= previous) errors[at("minDownPct")] = "order";
    if (max < min) errors[at("maxMonths")] = "belowMin";
    if (!Number.isNaN(minDown)) previous = minDown;
    return { min_down_pct: minDown, discount_pct: discount, min_months: min, max_months: max };
  });
}

function checkTerms(terms: readonly TermDraft[], check: Checker, errors: ProgramFieldErrors) {
  if (terms.length === 0) errors.terms = "required";
  let previous = 0;
  return terms.map((term, index) => {
    const value = check(`terms.${index}.months`, months(term.months));
    const rate = check(`terms.${index}.ratePct`, percent(term.ratePct, 100, false));
    if (value <= previous) errors[`terms.${index}.months`] = "order";
    if (!Number.isNaN(value)) previous = value;
    return { months: value, rate_pct: rate };
  });
}

// Коды parsePriceInput → коды ошибок редактора («Только число», «Вне допустимых пределов»).
const AMOUNT_ISSUES: Record<"required" | "notNumber" | "outOfRange", NumberIssue> = {
  required: "required",
  notNumber: "number",
  outOfRange: "range",
};

function checkFees(draft: ProgramDraft, check: Checker, errors: ProgramFieldErrors) {
  const seen = new Set<string>();
  return draft.fees.map((fee, index) => {
    const field = `fees.${index}.value`;
    if (seen.has(fee.name)) errors[`fees.${index}.name`] = "duplicate";
    seen.add(fee.name);
    // У наценки своей валюты нет — сумму не в чем считать (база: только %).
    if (draft.kind === "markup" && fee.kind === "fixed") errors[`fees.${index}.kind`] = "invalid";
    const amount = fee.kind === "fixed" ? parsePriceInput(fee.value) : null;
    const value = amount
      ? (amount.value ?? check(field, AMOUNT_ISSUES[amount.issue ?? "required"]))
      : check(field, percent(fee.value, 100, false));
    // Разовый платёж в 0 — не платёж (база: от 0,01).
    if (value === 0) errors[field] = "range";
    return { name: fee.name, kind: fee.kind, value };
  });
}

function checkConditions(draft: ProgramDraft, errors: ProgramFieldErrors) {
  const conditions = bilingualOrNull({
    ru: draft.conditions.ru.trim(),
    uz: draft.conditions.uz.trim(),
  });
  if (!conditions) return null;
  const issue = bilingualIssue(conditions, { required: true, max: PROGRAM_LIMITS.conditionsMax });
  if (issue) errors.conditions = issue;
  else if (bilingualHasContact(conditions)) errors.conditions = "contacts";
  return conditions;
}

/** Черновик → запись для save_payment_program или ошибки по полям. */
export function validateDraft(
  draft: ProgramDraft,
): { ok: true; payload: ProgramPayload } | { ok: false; errors: ProgramFieldErrors } {
  const errors: ProgramFieldErrors = {};
  const check = checker(errors);
  const { type, method } = typeAndMethod(draft);
  const scheme = draft.kind === "scheme";
  const bank = draft.kind === "bank" || draft.kind === "mortgage";
  if (bank && draft.bankId === null) errors.bank = "required";
  if (draft.blocksScope === "selected" && draft.blockIds.length === 0) errors.blocks = "required";
  const payload: ProgramPayload = {
    ...(draft.id ? { id: draft.id } : {}),
    developer_id: draft.developerId,
    bank_id: bank ? draft.bankId : null,
    type,
    method,
    discount_pct:
      draft.kind === "full" ? check("discountPct", percent(draft.discountPct, 50, false)) : null,
    min_down_pct:
      draft.kind === "full" || scheme
        ? null
        : check("minDownPct", percent(draft.minDownPct, 90, true)),
    tiers: scheme ? checkTiers(draft.tiers, check, errors) : [],
    terms: draft.kind === "full" || scheme ? [] : checkTerms(draft.terms, check, errors),
    fees: draft.kind === "full" || scheme ? [] : checkFees(draft, check, errors),
    preset_months: scheme ? [...draft.presetMonths].sort((a, b) => a - b) : [],
    allow_custom_months: scheme && draft.allowCustomMonths,
    over_max_behavior: draft.overMaxBehavior,
    currency: bank ? draft.currency : null,
    blocks_scope: draft.blocksScope,
    block_ids: draft.blocksScope === "selected" ? draft.blockIds : [],
    conditions: checkConditions(draft, errors),
  };
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, payload };
}
