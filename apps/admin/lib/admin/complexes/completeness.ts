import { parseReadiness, type ComplexRequirement, type ReadinessItem, type ReadinessRecord } from "./readiness";

// Полнота ЖК и планировок (docs/publication-rule.md): считает база (public.complex_completeness),
// здесь — разбор ответа для кабинета: состояние, «Не хватает: …», «Полных квартир: k из n».

export type ComplexSiteState = "draft" | "soon" | "full";
export type LayoutGap = "price" | "drawing";

export type LayoutCompleteness = { id: string; blockId: string; complete: boolean; missing: LayoutGap[] };

export type ComplexCompleteness = {
  state: ComplexSiteState;
  requirements: ReadinessItem[];
  missing: ComplexRequirement[];
  coverOk: boolean;
  programOk: boolean;
  rateOk: boolean;
  layouts: LayoutCompleteness[];
  completeLayouts: number;
};

export type ComplexCompletenessRecord = {
  state: ComplexSiteState;
  requirements: ReadinessRecord[];
  cover_ok: boolean;
  program_ok: boolean;
  rate_ok: boolean;
  layouts: { id: string; block_id: string; complete: boolean; missing: string[] }[];
};

const isGap = (value: string): value is LayoutGap => value === "price" || value === "drawing";

export function layoutCompleteness(record: ComplexCompletenessRecord["layouts"][number]): LayoutCompleteness {
  return {
    id: record.id,
    blockId: record.block_id,
    complete: record.complete,
    missing: record.missing.filter(isGap),
  };
}

export function complexCompleteness(record: ComplexCompletenessRecord): ComplexCompleteness {
  const requirements = parseReadiness(record.requirements);
  const layouts = record.layouts.map(layoutCompleteness);
  return {
    state: record.state,
    requirements,
    missing: requirements.filter((item) => !item.ok).map((item) => item.requirement),
    coverOk: record.cover_ok,
    programOk: record.program_ok,
    rateOk: record.rate_ok,
    layouts,
    completeLayouts: layouts.filter((layout) => layout.complete).length,
  };
}
