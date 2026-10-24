import type { CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { Currency } from "@/lib/calc/money";
import type { FeeName, OverMaxBehavior, ProgramMethod, ProgramType } from "@/lib/calc/programs";
import { EMPTY_BILINGUAL, type BilingualValue } from "../bilingual";
import type { ProgramItem, ProgramKind } from "./types";

// Черновик карточки-редактора (Р2, В1–В2): числа — строками, как их набрали; строки ступеней,
// сроков и разовых — с ключами для React. Проверка и сборка записи — validate.ts.

export type TierDraft = {
  key: string;
  minDownPct: string;
  discountPct: string;
  minMonths: string;
  maxMonths: string;
};
export type TermDraft = { key: string; months: string; ratePct: string };
export type FeeDraft = { key: string; name: FeeName; kind: "fixed" | "pct"; value: string };

export type ProgramDraft = {
  id: string | null;
  developerId: string;
  kind: ProgramKind;
  /** Аннуитет или дифференцированный — у банка и ипотеки. */
  bankMethod: "annuity" | "differentiated";
  bankId: number | null;
  currency: Currency;
  discountPct: string;
  minDownPct: string;
  tiers: TierDraft[];
  terms: TermDraft[];
  fees: FeeDraft[];
  presetMonths: number[];
  allowCustomMonths: boolean;
  overMaxBehavior: OverMaxBehavior;
  blocksScope: "all" | "selected";
  blockIds: string[];
  conditions: BilingualValue;
};

let lastKey = 0;
/** Ключ строки черновика: уникален в рамках вкладки, в базу не уходит. */
export const rowKey = () => `row-${(lastKey += 1)}`;

const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

export const emptyTier = (): TierDraft => ({
  key: rowKey(),
  minDownPct: "",
  discountPct: "0",
  minMonths: "1",
  maxMonths: "",
});
export const emptyTerm = (): TermDraft => ({ key: rowKey(), months: "", ratePct: "" });
export const emptyFee = (kind: "fixed" | "pct" = "pct"): FeeDraft => ({
  key: rowKey(),
  name: "commission",
  kind,
  value: "",
});

/** Новая программа выбранного вида: в схеме — одна пустая ступень, у банков — одна строка. */
export function newDraft(kind: ProgramKind, developerId: string): ProgramDraft {
  return {
    id: null,
    developerId,
    kind,
    bankMethod: "annuity",
    bankId: null,
    currency: kind === "bank" || kind === "mortgage" ? "UZS" : "USD",
    discountPct: kind === "full" ? "0" : "",
    minDownPct: "",
    tiers: kind === "scheme" ? [emptyTier()] : [],
    terms: kind === "full" || kind === "scheme" ? [] : [emptyTerm()],
    fees: [],
    presetMonths: kind === "scheme" ? [12, 24, 36, 48] : [],
    allowCustomMonths: kind === "scheme",
    overMaxBehavior: "block",
    blocksScope: "all",
    blockIds: [],
    conditions: EMPTY_BILINGUAL,
  };
}

/** Черновик из записи базы — «Изменить» на карточке. */
export function draftFromItem(item: ProgramItem): ProgramDraft {
  const record: CabinetProgramRecord = item.record;
  return {
    ...newDraft(item.kind, item.developerId),
    id: item.id,
    bankMethod: record.method === "differentiated" ? "differentiated" : "annuity",
    bankId: record.bank_id,
    currency: record.currency ?? "USD",
    discountPct: text(record.discount_pct),
    minDownPct: text(record.min_down_pct),
    tiers: record.tiers.map((tier) => ({
      key: rowKey(),
      minDownPct: text(tier.min_down_pct),
      discountPct: text(tier.discount_pct),
      minMonths: text(tier.min_months),
      maxMonths: text(tier.max_months),
    })),
    terms: record.terms.map((term) => ({
      key: rowKey(),
      months: text(term.months),
      ratePct: text(term.rate_pct),
    })),
    fees: record.fees.map((fee) => ({ key: rowKey(), ...fee, value: text(fee.value) })),
    presetMonths: record.preset_months.map(Number),
    allowCustomMonths: record.allow_custom_months,
    overMaxBehavior: record.over_max_behavior,
    blocksScope: record.blocks_scope,
    blockIds: [...record.block_ids],
    conditions: record.conditions ?? EMPTY_BILINGUAL,
  };
}

/** Тип и метод записи базы по виду. */
export function typeAndMethod(draft: ProgramDraft): {
  type: ProgramType;
  method: ProgramMethod | null;
} {
  switch (draft.kind) {
    case "full":
      return { type: "full", method: null };
    case "scheme":
      return { type: "installment", method: "tiers" };
    case "markup":
      return { type: "installment", method: "markup" };
    case "bank":
      return { type: "bank_installment", method: draft.bankMethod };
    case "mortgage":
      return { type: "mortgage", method: draft.bankMethod };
  }
}

/** Набранное число или null (пусто, не число) — для подписей строк редактора. */
export function draftNumber(raw: string): number | null {
  const text = raw.trim().replace(/\s+/g, "").replace(",", ".");
  const value = Number(text);
  return text && Number.isFinite(value) ? value : null;
}

/** Число как набрано; недописанное — 0 (превью не ломается, «Пример» просто не считается). */
const loose = (raw: string) => draftNumber(raw) ?? 0;

/**
 * Запись для живого превью карточки (В1): та же форма, что приходит из базы, — карточка и
 * «Пример» показывают черновик так, как его покажет сохранённая программа.
 */
export function recordFromDraft(
  draft: ProgramDraft,
  base: Pick<CabinetProgramRecord, "is_active" | "sort" | "created_at" | "updated_at">,
  bankName: BilingualValue | null,
): CabinetProgramRecord & { bank: unknown } {
  const { type, method } = typeAndMethod(draft);
  const bank = draft.kind === "bank" || draft.kind === "mortgage";
  return {
    ...base,
    id: draft.id ?? "draft",
    developer_id: draft.developerId,
    bank_id: bank ? draft.bankId : null,
    bank: bank ? bankName : null,
    type,
    method,
    discount_pct: draft.kind === "full" ? loose(draft.discountPct) : null,
    min_down_pct: draft.kind === "full" || draft.kind === "scheme" ? null : loose(draft.minDownPct),
    // Пустая новая строка в превью не становится чипом «от 0% · до 0 мес.».
    tiers: draft.tiers
      .filter((tier) => draftNumber(tier.minDownPct) !== null && draftNumber(tier.maxMonths))
      .map((tier) => ({
        min_down_pct: loose(tier.minDownPct),
        discount_pct: loose(tier.discountPct),
        min_months: loose(tier.minMonths),
        max_months: loose(tier.maxMonths),
      })),
    terms: draft.terms
      .filter((term) => draftNumber(term.months))
      .map((term) => ({ months: loose(term.months), rate_pct: loose(term.ratePct) })),
    fees: draft.fees.map((fee) => ({ name: fee.name, kind: fee.kind, value: loose(fee.value) })),
    preset_months: [...draft.presetMonths].sort((a, b) => a - b),
    allow_custom_months: draft.allowCustomMonths,
    over_max_behavior: draft.overMaxBehavior,
    currency: bank ? draft.currency : null,
    blocks_scope: draft.blocksScope,
    block_ids: draft.blocksScope === "selected" ? draft.blockIds : [],
    conditions: draft.conditions.ru && draft.conditions.uz ? draft.conditions : null,
  };
}
