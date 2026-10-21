// Генератор списка (№8, Н6): поля формы — строки, план — числа для lib/units. Чистые функции:
// экран считает по ним живой итог на каждое нажатие.

import {
  BLOCK_PLAN_LIMITS,
  applyRisers,
  generateUnits,
  type BlockPlan,
  type BlockPlanIssue,
  type Riser,
} from "@/lib/units";

export type GeneratorInputs = {
  entrances: string;
  firstFloor: string;
  /** Квартир на этаже — одно число для всех подъездов. */
  perFloor: string;
  /** «В подъездах по-разному» — тогда своё число у каждого подъезда. */
  perEntrance: boolean;
  perEntranceValues: string[];
  startNumber: string;
};

/** Мокап и DEMO: 2 подъезда, квартиры со 2-го этажа (ниже — коммерция), 4 на этаже, № 1. */
export function generatorDefaults(floors: number): GeneratorInputs {
  return {
    entrances: "2",
    firstFloor: floors >= 2 ? "2" : "1",
    perFloor: "4",
    perEntrance: false,
    perEntranceValues: [],
    startNumber: "1",
  };
}

const toInt = (raw: string) => (/^\s*\d+\s*$/.test(raw) ? Number(raw) : Number.NaN);

export function generatorPlan(inputs: GeneratorInputs, floors: number): BlockPlan {
  const entrances = toInt(inputs.entrances);
  const { min, max } = BLOCK_PLAN_LIMITS.entrances;
  const count = Number.isInteger(entrances) && entrances >= min && entrances <= max ? entrances : 0;
  // «По-разному» имеет смысл от двух подъездов: у одного — общее поле, оно и на экране.
  const perEntrance = inputs.perEntrance && count > 1;
  const perFloor = Array.from({ length: count }, (_, index) =>
    toInt(perEntrance ? (inputs.perEntranceValues[index] ?? inputs.perFloor) : inputs.perFloor),
  );
  return {
    entrances,
    floors,
    firstResidentialFloor: toInt(inputs.firstFloor),
    unitsPerFloor: perFloor,
    startNumber: toInt(inputs.startNumber),
  };
}

/** Какое поле подсвечивать: «подъездов нет» не дублируется «укажите по подъездам». */
export function generatorIssues(issues: readonly BlockPlanIssue[]): BlockPlanIssue[] {
  const noEntrances = issues.some((issue) => issue.code === "entrancesOutOfRange");
  return issues.filter((issue) => !(noEntrances && issue.code === "unitsPerFloorCountMismatch"));
}

/** Поля, от которых зависят стояки: номер квартиры их не меняет. */
export function samePlanShape(a: BlockPlan, b: BlockPlan): boolean {
  return (
    a.entrances === b.entrances &&
    a.floors === b.floors &&
    a.firstResidentialFloor === b.firstResidentialFloor &&
    a.unitsPerFloor.join() === b.unitsPerFloor.join()
  );
}

/** Сколько квартир останутся без планировки при этих стояках. */
export function unassignedCount(plan: BlockPlan, risers: readonly Riser[]): number {
  return applyRisers(generateUnits(plan), risers).filter((unit) => unit.layoutId === null).length;
}
