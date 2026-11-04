export type StepState = "ahead" | "current" | "passed";

/** Состояние шага ленты «О ЖК» по номеру дошедшего шага (−1 — ни одного). */
export function stepState(index: number, active: number): StepState {
  if (index < active) return "passed";
  return index === active ? "current" : "ahead";
}
