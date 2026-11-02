import { calculate, type CalcInput, type CalcResult } from "./calculate";
import { comparePrograms, type ComparisonRow } from "./compare";
import { type CalcProgram, isTiered, type ProgramKind } from "./programs";
import type { BilingualRecord } from "./records";

// Программа в калькуляторе (кабинет, /kalkulyator, расчёт квартиры): условия для lib/calc и то,
// что нужно интерфейсу. Чем считать — «движок»: сайт — calculate, кабинет — со скидками
// (lib/calc/cabinet/engine.ts); общий калькулятор про скидки не знает (PLAN §3.13).

export type ProgramOption<P extends CalcProgram = CalcProgram> = {
  id: string;
  kind: ProgramKind;
  bankName: BilingualRecord | null;
  blocksScope: "all" | "selected";
  blockIds: readonly string[];
  /** «Условия актуальны на» (Р5). */
  updatedAt: string | null;
  program: P;
};

/** Программа действует для блока квартиры; блок неизвестен (площадь, сумма) — любая. */
export const appliesToBlock = (option: ProgramOption<CalcProgram>, blockId: string | null) =>
  blockId === null || option.blocksScope === "all" || option.blockIds.includes(blockId);

/** Чип взноса (В5 B): у схемы — ступень «50% · до 18 мес.», у банков — быстрые взносы. */
export type DownOption = {
  downPct: number;
  maxMonths: number | null;
  /** Чип ведёт в другую программу («100%» — в «100% оплата» в кабинете). */
  targetId: string | null;
};

export type Comparison<P extends CalcProgram> = {
  rows: ComparisonRow<P>[];
  unavailable: P[];
};

export type CalcEngine<P extends CalcProgram> = {
  calculate: (program: P, input: CalcInput) => CalcResult;
  compare: (programs: readonly P[], input: CalcInput) => Comparison<P>;
  downOptions: (option: ProgramOption<P>, options: readonly ProgramOption<P>[]) => DownOption[];
};

const QUICK_DOWNS = [30, 50] as const;

export function baseDownOptions(program: CalcProgram): DownOption[] {
  if (program.type === "full") return [];
  if (isTiered(program)) {
    return program.tiers.map((tier) => ({
      downPct: tier.minDownPct,
      maxMonths: tier.maxMonths,
      targetId: null,
    }));
  }
  const downs = [program.minDownPct, ...QUICK_DOWNS.filter((pct) => pct > program.minDownPct)];
  return downs.map((downPct) => ({ downPct, maxMonths: null, targetId: null }));
}

export const SITE_ENGINE: CalcEngine<CalcProgram> = {
  calculate: (program, input) => calculate(program, input),
  compare: (programs, input) => comparePrograms(programs, input),
  downOptions: (option) => baseDownOptions(option.program),
};
