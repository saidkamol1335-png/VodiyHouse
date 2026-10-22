"use server";

import { devOnly } from "../devOnly";
import { refresh } from "next/cache";
import { demoBlockUnits } from "@/lib/admin/complexes/demoUnits";
import { demoUnitsScenario } from "@/lib/admin/complexes/demoUnitsScenarios";
import { unitsFailure } from "@/lib/admin/units/errors";
import {
  blockNameConfirmed,
  isUuid,
  readFinishing,
  readLayout,
  readPrice,
  readUnitIds,
  readUnitPatch,
} from "@/lib/admin/units/parse";
import type {
  AddUnitInput,
  ChangedResult,
  DeleteBlockUnitsInput,
  DeleteUnitsResult,
  SetUnitsFinishingInput,
  SetUnitsPriceInput,
  SetUnitsPriceResult,
  UnitIdsInput,
  UnitRowResult,
  UpdateUnitInput,
} from "@/lib/admin/units/types";
import { isUnitNumber, normalizeUnitNumber, type UnitRecord } from "@/lib/units";
import ru from "@/messages/ru.json";

// Правки руководителя на стенде /dev/zhk (12.5): тот же разбор входа и те же отказы, что у базы
// (номер занят, место занято, весь список, название блока), без базы — DEMO не меняется, ответ
// описывает правку. Первый аргумент — сценарий стенда: fail — база не успела, notready — снятая
// цена убрала бы «цену от» опубликованного ЖК. refresh() — как updateTag настоящих действий.
// Ответ считается по сиду, а не по правкам, уже сделанным на экране: вторая правка той же
// квартиры (отделка «как в блоке» после «Под ключ», номер после массовой цены, правка добавленной)
// может ответить «ничего не поменялось», прежней ценой или «не найдено». На стенде проверять
// первую правку; повторные — тестами базы (tests/db/units-*).

/** Как в базе: ответ называет того, кто правил, — на стенде это сотрудник стенда (как на странице). */
const DEMO_AUTHOR = ru.admin.user.devName;

/** Квартиры блока по сценарию; null — нет такого блока. */
const blockOf = (scenario: unknown, blockId: unknown) =>
  isUuid(blockId) ? demoBlockUnits(blockId, demoUnitsScenario(scenario)) : null;

const failed = (scenario: unknown) => demoUnitsScenario(scenario) === "fail";

export async function demoAddUnitAction(
  scenario: unknown,
  input: AddUnitInput,
): Promise<UnitRowResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  if (!block) return unitsFailure("notFound");
  const number = typeof input.number === "string" ? normalizeUnitNumber(input.number) : "";
  if (!isUnitNumber(number)) return unitsFailure("invalid", "number");
  const layoutId = readLayout(input.layoutId);
  if (layoutId === undefined) return unitsFailure("invalid", "layout_id");
  const { entrance, floor, position } = input;
  const inside = (value: number, max: number) =>
    Number.isInteger(value) && value >= 1 && value <= max;
  if (!inside(entrance, 50) || !inside(position, 50) || !inside(floor, block.floors ?? 0))
    return unitsFailure("invalid", "slot");
  if (failed(scenario)) return unitsFailure("timeout");
  if (block.units.some((unit) => unit.number === number))
    return unitsFailure("unitNumberTaken", "number");
  const taken = (unit: UnitRecord) =>
    unit.entrance === entrance && unit.floor === floor && unit.position === position;
  if (block.units.some(taken)) return unitsFailure("unitSlotTaken", "slot");
  refresh();
  const unit: UnitRecord = {
    id: crypto.randomUUID(),
    entrance,
    floor,
    position,
    number,
    layoutId,
    price: null,
    pricePerM2: null,
    finishingId: null,
    status: "free",
    updatedAt: new Date().toISOString(),
    updatedByName: DEMO_AUTHOR,
  };
  return { status: "done", unit };
}

/** Правка строки: патч разбирается как у update_unit; номер — не чужой. */
export async function demoUpdateUnitAction(
  scenario: unknown,
  input: UpdateUnitInput,
): Promise<UnitRowResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  const unit = block?.units.find((item) => item.id === input?.unitId);
  if (!block || !unit) return unitsFailure("notFound");
  const patch = readUnitPatch(input.patch);
  if (!patch) return unitsFailure("invalid");
  if (failed(scenario)) return unitsFailure("timeout");
  const number = typeof patch.number === "string" ? patch.number : unit.number;
  if (block.units.some((item) => item.number === number && item.id !== unit.id))
    return unitsFailure("unitNumberTaken", "number");
  const price = patch.price as { mode: string; value: number | null } | undefined;
  if (price?.mode === "none" && demoUnitsScenario(scenario) === "notready") return notReady();
  refresh();
  return { status: "done", unit: { ...patched(unit, patch), updatedByName: DEMO_AUTHOR } };
}

function patched(unit: UnitRecord, patch: Record<string, unknown>): UnitRecord {
  const price = patch.price as { mode: string; value: number | null } | undefined;
  return {
    ...unit,
    number: typeof patch.number === "string" ? patch.number : unit.number,
    layoutId: "layout_id" in patch ? (patch.layout_id as string | null) : unit.layoutId,
    finishingId: "finishing_id" in patch ? (patch.finishing_id as number | null) : unit.finishingId,
    price: price ? (price.mode === "total" ? price.value : null) : unit.price,
    pricePerM2: price ? (price.mode === "per_m2" ? price.value : null) : unit.pricePerM2,
    updatedAt: new Date().toISOString(),
  };
}

const notReady = (): UnitRowResult & SetUnitsPriceResult => ({
  status: "error",
  error: "notReady",
  field: null,
  broken: ["layouts"],
});

export async function demoDeleteUnitsAction(
  scenario: unknown,
  input: UnitIdsInput,
): Promise<DeleteUnitsResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  const ids = readUnitIds(input?.unitIds);
  if (!block || !ids) return unitsFailure("invalid");
  if (failed(scenario)) return unitsFailure("timeout");
  if (ids.length >= block.units.length) return unitsFailure("wholeList");
  refresh();
  return { status: "done", deleted: block.units.filter((unit) => ids.includes(unit.id)).length };
}

export async function demoDeleteBlockUnitsAction(
  scenario: unknown,
  input: DeleteBlockUnitsInput,
): Promise<DeleteUnitsResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  if (!block) return unitsFailure("notFound");
  if (typeof input.confirm !== "string" || !blockNameConfirmed(input.confirm, block.name))
    return unitsFailure("confirmName");
  if (failed(scenario)) return unitsFailure("timeout");
  refresh();
  return { status: "done", deleted: block.units.length };
}

/** Цена: сколько квартир поменялось бы и сколько без планировки (за м² — «по запросу»). */
export async function demoSetUnitsPriceAction(
  scenario: unknown,
  input: SetUnitsPriceInput,
): Promise<SetUnitsPriceResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  const ids = readUnitIds(input?.unitIds);
  const price = readPrice(input?.mode, input?.value);
  if (!block || !ids) return unitsFailure("invalid");
  if (!price) return unitsFailure("invalid", "price");
  if (failed(scenario)) return unitsFailure("timeout");
  if (price.mode === "none" && demoUnitsScenario(scenario) === "notready") return notReady();
  const chosen = block.units.filter((unit) => ids.includes(unit.id));
  const total = price.mode === "total" ? price.value : null;
  const perM2 = price.mode === "per_m2" ? price.value : null;
  const changed = chosen.filter((unit) => unit.price !== total || unit.pricePerM2 !== perM2);
  refresh();
  const withoutLayout =
    price.mode === "per_m2" ? chosen.filter((unit) => !unit.layoutId).length : 0;
  return { status: "done", changed: changed.length, withoutLayout };
}

export async function demoSetUnitsFinishingAction(
  scenario: unknown,
  input: SetUnitsFinishingInput,
): Promise<ChangedResult> {
  devOnly();
  const block = blockOf(scenario, input?.blockId);
  const ids = readUnitIds(input?.unitIds);
  const finishing = readFinishing(input?.finishingId);
  if (!block || !ids) return unitsFailure("invalid");
  if (finishing === undefined) return unitsFailure("invalid", "finishing_id");
  if (failed(scenario)) return unitsFailure("timeout");
  refresh();
  const chosen = block.units.filter((unit) => ids.includes(unit.id));
  return {
    status: "done",
    changed: chosen.filter((unit) => unit.finishingId !== finishing).length,
  };
}
