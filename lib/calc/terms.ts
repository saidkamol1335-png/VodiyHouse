import {
  type CalcProgram,
  type TieredProgram,
  type DownTier,
  type OverMaxBehavior,
  type TermRow,
  type TermsProgram,
  isTiered,
} from "./programs";

// Сроки (PLAN §3б, §7 фаза 2): у схемы застройщика — ступень по взносу, кнопки 12/24/36/48
// в её пределах и свой срок; у наценки и банков — только их строки.

export type TermStatus = "ok" | "aboveMax" | "belowMin" | "notOffered";

/** «24 мес. — при взносе 30–49 %» (suggest_tier); toDownPct включительно. */
export type TierSuggestion = { months: number; fromDownPct: number; toDownPct: number };

export type TermOutcome = {
  /** Что просили; null — срок по умолчанию. */
  requested: number | null;
  /** На какой срок посчитано. */
  applied: number;
  min: number;
  max: number;
  status: TermStatus;
  /** Что делает программа при превышении (только схема застройщика). */
  behavior: OverMaxBehavior | null;
  suggestion: TierSuggestion | null;
};

/** Ступень по взносу: последняя, чей порог не выше взноса (PLAN §7: максимальный tier с min ≤ d). */
export function tierIndexFor(tiers: readonly DownTier[], downPct: number): number {
  let index = 0;
  tiers.forEach((tier, position) => {
    if (downPct >= tier.minDownPct) index = position;
  });
  return index;
}

/** Кнопки сроков: у схемы — preset ∩ [min, max] ступени; у остальных — строки программы. */
export function termButtons(program: CalcProgram, downPct: number): number[] {
  if (program.type === "full") return [];
  if (!isTiered(program)) return program.terms.map((row) => row.months);
  const tier = program.tiers[tierIndexFor(program.tiers, downPct)];
  if (!tier) return [];
  return [...program.presetMonths]
    .filter((months) => months >= tier.minMonths && months <= tier.maxMonths)
    .sort((a, b) => a - b);
}

export const allowsCustomMonths = (program: CalcProgram) =>
  isTiered(program) && program.allowCustomMonths;

/** Ступень ниже текущей, где такой срок есть, — ближайшая к выбранному взносу. */
function suggestTier(
  tiers: readonly DownTier[],
  months: number,
  currentIndex: number,
): TierSuggestion | null {
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const tier = tiers[index]!;
    if (months >= tier.minMonths && months <= tier.maxMonths) {
      const next = tiers[index + 1]!;
      return { months, fromDownPct: tier.minDownPct, toDownPct: next.minDownPct - 1 };
    }
  }
  return null;
}

/** Без своего срока по умолчанию — самая длинная кнопка, иначе — максимум ступени. */
function defaultSchemeMonths(program: TieredProgram, buttons: number[], max: number) {
  return program.allowCustomMonths ? max : (buttons.at(-1) ?? max);
}

/**
 * Срок схемы застройщика. Сверх максимума: block — считаем на максимуме (как мокап),
 * suggest_tier — тоже на максимуме и подсказка взноса, lead — на просимом сроке.
 */
export function resolveSchemeMonths(
  program: TieredProgram,
  downPct: number,
  requested: number | null,
): TermOutcome {
  const index = tierIndexFor(program.tiers, downPct);
  const tier = program.tiers[index]!;
  const { minMonths: min, maxMonths: max } = tier;
  const behavior = program.overMaxBehavior;
  const base = { requested, min, max, behavior, suggestion: null };
  const buttons = termButtons(program, downPct);
  if (requested === null) {
    return { ...base, applied: defaultSchemeMonths(program, buttons, max), status: "ok" };
  }
  if (!program.allowCustomMonths && !buttons.includes(requested)) {
    return { ...base, applied: defaultSchemeMonths(program, buttons, max), status: "notOffered" };
  }
  if (requested < min) return { ...base, applied: min, status: "belowMin" };
  if (requested <= max) return { ...base, applied: requested, status: "ok" };
  const suggestion =
    behavior === "suggest_tier" ? suggestTier(program.tiers, requested, index) : null;
  const applied = behavior === "lead" ? requested : max;
  return { ...base, applied, status: "aboveMax", suggestion };
}

/** Строка срока: просимая, а если её нет — самая длинная (мокап termRow). */
export function resolveTermRow(
  program: TermsProgram,
  requested: number | null,
): { row: TermRow; term: TermOutcome } | null {
  if (program.terms.length === 0) return null;
  const months = program.terms.map((row) => row.months);
  const longest = program.terms.reduce((a, b) => (b.months > a.months ? b : a));
  const found = requested === null ? null : program.terms.find((row) => row.months === requested);
  const row = found ?? longest;
  const status: TermStatus = requested === null || found ? "ok" : "notOffered";
  return {
    row,
    term: {
      requested,
      applied: row.months,
      min: Math.min(...months),
      max: longest.months,
      status,
      behavior: null,
      suggestion: null,
    },
  };
}
