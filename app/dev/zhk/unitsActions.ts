"use server";

import { refresh } from "next/cache";
import { demoBlockUnits } from "@/lib/admin/complexes/demoUnits";
import { demoUnitsScenario } from "@/lib/admin/complexes/demoUnitsScenarios";
import { unitsFailure } from "@/lib/admin/units/errors";
import { isUuid, readPlan, readRisers, readStatus, readUnitIds } from "@/lib/admin/units/parse";
import type {
  BlockUnitsInput,
  BlockUnitsResult,
  CreateBlockUnitsInput,
  CreateBlockUnitsResult,
  RevertUnitsStatusInput,
  RevertUnitsStatusResult,
  SaveRisersInput,
  SaveRisersResult,
  SetUnitsStatusInput,
  SetUnitsStatusResult,
} from "@/lib/admin/units/types";
import {
  applyRisers,
  generateUnits,
  parseUnitsUndo,
  planFromUnits,
  riserEdits,
  type UnitStatus,
} from "@/lib/units";

// «Квартиры» на стенде /dev/zhk: тот же разбор входа, что у настоящих действий, без базы — DEMO
// не меняется. Первый аргумент — сценарий стенда (?demo=…, привязан через .bind). Статус и
// «Отменить» перерисовывают страницу (refresh), как updateTag у настоящих: e2e видит, что
// перерисовка не перечитывает список. Раз DEMO не меняется, «было» всегда берётся из сида:
// второй тап по той же квартире на стенде даёт ложное «в базе было …» и откат после чтения —
// в облаке база ответит верно (это проверяет юнит-тест statusOutcome, а не e2e).

function devOnly() {
  if (process.env.NODE_ENV === "production") throw new Error("Стенд только для разработки");
}

/** Генератор: тот же разбор и те же строки lib/units — ответ «создано N». */
export async function demoCreateBlockUnitsAction(
  input: CreateBlockUnitsInput,
): Promise<CreateBlockUnitsResult> {
  devOnly();
  const plan = readPlan(input?.plan);
  const risers = plan ? readRisers(input.risers, plan) : null;
  if (!plan || !risers) return unitsFailure("invalid");
  const units = applyRisers(generateUnits(plan), risers);
  const unassigned = units.filter((unit) => unit.layoutId === null).length;
  return { status: "done", created: units.length, unassigned };
}

/** Стояки: снимок и правки — как у настоящего действия. */
export async function demoSaveRisersAction(
  scenario: unknown,
  input: SaveRisersInput,
): Promise<SaveRisersResult> {
  devOnly();
  const block = isUuid(input?.blockId)
    ? demoBlockUnits(input.blockId, demoUnitsScenario(scenario))
    : null;
  if (!block) return unitsFailure("notFound");
  const plan = planFromUnits(block.units, block.floors);
  const base = readRisers(input.base, plan);
  const risers = readRisers(input.risers, plan);
  if (!base || !risers) return unitsFailure("invalid");
  const { changes, skipped } = riserEdits(block.units, base, risers);
  return { status: "done", changed: changes.length, skipped: skipped.map((unit) => unit.number) };
}

export async function demoReadBlockUnitsAction(
  scenario: unknown,
  input: BlockUnitsInput,
): Promise<BlockUnitsResult> {
  devOnly();
  if (!isUuid(input?.blockId)) return unitsFailure("notFound");
  const kind = demoUnitsScenario(scenario);
  if (kind === "empty") return { status: "done", units: [] };
  return { status: "done", units: demoBlockUnits(input.blockId, kind)?.units ?? [] };
}

/** Статус: undo — прежние статусы DEMO группами; conflict — «было» не то, что на экране. */
export async function demoSetUnitsStatusAction(
  scenario: unknown,
  input: SetUnitsStatusInput,
): Promise<SetUnitsStatusResult> {
  devOnly();
  const ids = readUnitIds(input?.unitIds);
  const status = readStatus(input?.status);
  if (!isUuid(input?.blockId) || !ids || !status) return unitsFailure("invalid");
  const kind = demoUnitsScenario(scenario);
  if (kind === "fail") return unitsFailure("timeout");
  const units = demoBlockUnits(input.blockId, kind)?.units ?? [];
  const groups = new Map<UnitStatus, string[]>();
  for (const unit of units.filter((item) => ids.includes(item.id) && item.status !== status)) {
    const was = kind === "conflict" ? otherStatus(unit.status, status) : unit.status;
    groups.set(was, [...(groups.get(was) ?? []), unit.id]);
  }
  refresh();
  const undo = [...groups].map(([was, unitIds]) => ({ status: was, ids: unitIds }));
  return { status: "done", changed: undo.reduce((sum, group) => sum + group.ids.length, 0), undo };
}

const otherStatus = (shown: UnitStatus, to: UnitStatus): UnitStatus =>
  (["free", "reserved", "sold"] as const).find((item) => item !== shown && item !== to)!;

/** «Отменить»: conflict — квартиры уже поменял другой (skipped). */
export async function demoRevertUnitsStatusAction(
  scenario: unknown,
  input: RevertUnitsStatusInput,
): Promise<RevertUnitsStatusResult> {
  devOnly();
  const status = readStatus(input?.status);
  const undo = parseUnitsUndo(input?.undo);
  if (!isUuid(input?.blockId) || !status || !undo) return unitsFailure("invalid");
  if (undo.some((group) => group.status === status)) return unitsFailure("invalid");
  const kind = demoUnitsScenario(scenario);
  if (kind === "fail") return unitsFailure("timeout");
  const ids = undo.flatMap((group) => group.ids);
  refresh();
  if (kind !== "conflict") return { status: "done", reverted: ids.length, skipped: [], missing: 0 };
  const units = demoBlockUnits(input.blockId, kind)?.units ?? [];
  const skipped = units.filter((unit) => ids.includes(unit.id)).map((unit) => unit.number);
  return { status: "done", reverted: 0, skipped, missing: 0 };
}
