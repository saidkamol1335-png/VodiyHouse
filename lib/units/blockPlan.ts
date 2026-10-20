// Генератор блока (PLAN §7, фаза 1): подъезды × жилые этажи × квартиры на этаже → список
// квартир со сквозной нумерацией. Чистые функции: экран генератора показывает по ним живой
// итог, сервер — создаёт квартиры (решение фазы 1, в. 8).

/** Параметры генератора — поля экрана «Блок — генератор». */
export type BlockPlan = {
  entrances: number;
  /** Этажность — номер верхнего этажа. */
  floors: number;
  /** Ниже — коммерция и входные группы: квартир там нет. */
  firstResidentialFloor: number;
  /** Квартир на этаже — отдельно для каждого подъезда, по порядку. */
  unitsPerFloor: readonly number[];
  /** Номер первой квартиры; дальше нумерация сквозная. */
  startNumber: number;
};

/** Место квартиры в блоке: подъезд, этаж, позиция на этаже (номер стояка). */
export type UnitSlot = { entrance: number; floor: number; position: number };

export type GeneratedUnit = UnitSlot & { number: string };

// Совпадают с проверками таблиц blocks и units: генератор не предложит то, что отвергнет база.
export const BLOCK_PLAN_LIMITS = {
  entrances: { min: 1, max: 50 },
  floors: { min: 1, max: 100 },
  unitsPerFloor: { min: 1, max: 50 },
  startNumber: { min: 1, max: 99_999 },
  totalUnits: 5_000,
} as const;

export type BlockPlanIssue =
  | { code: "entrancesOutOfRange" }
  | { code: "floorsOutOfRange" }
  | { code: "firstResidentialFloorOutOfRange" }
  | { code: "unitsPerFloorCountMismatch" }
  | { code: "unitsPerFloorOutOfRange"; entrance: number }
  | { code: "startNumberOutOfRange" }
  | { code: "tooManyUnits"; total: number };

export type EntranceSummary = {
  entrance: number;
  count: number;
  firstNumber: number;
  lastNumber: number;
};

/** Живой итог под формой: «180 квартир · № 1–180» и разбивка по подъездам. */
export type BlockPlanSummary = {
  total: number;
  residentialFloors: number;
  firstNumber: number;
  lastNumber: number;
  entrances: EntranceSummary[];
};

const inRange = (value: number, { min, max }: { min: number; max: number }) =>
  Number.isInteger(value) && value >= min && value <= max;

export function validateBlockPlan(plan: BlockPlan): BlockPlanIssue[] {
  const issues: BlockPlanIssue[] = [];
  const limits = BLOCK_PLAN_LIMITS;
  if (!inRange(plan.entrances, limits.entrances)) issues.push({ code: "entrancesOutOfRange" });
  if (!inRange(plan.floors, limits.floors)) issues.push({ code: "floorsOutOfRange" });
  if (!inRange(plan.firstResidentialFloor, { min: 1, max: plan.floors })) {
    issues.push({ code: "firstResidentialFloorOutOfRange" });
  }
  if (plan.unitsPerFloor.length !== plan.entrances) {
    issues.push({ code: "unitsPerFloorCountMismatch" });
  }
  plan.unitsPerFloor.forEach((count, index) => {
    if (!inRange(count, limits.unitsPerFloor)) {
      issues.push({ code: "unitsPerFloorOutOfRange", entrance: index + 1 });
    }
  });
  if (!inRange(plan.startNumber, limits.startNumber))
    issues.push({ code: "startNumberOutOfRange" });

  if (issues.length === 0) {
    const total = residentialFloorsOf(plan) * sum(plan.unitsPerFloor);
    if (total > limits.totalUnits) issues.push({ code: "tooManyUnits", total });
  }
  return issues;
}

/** Итог без генерации списка — для подсказки при каждом нажатии; null, пока параметры неверны. */
export function summarizeBlockPlan(plan: BlockPlan): BlockPlanSummary | null {
  if (validateBlockPlan(plan).length > 0) return null;
  const residentialFloors = residentialFloorsOf(plan);
  const entrances: EntranceSummary[] = [];
  let nextNumber = plan.startNumber;
  plan.unitsPerFloor.forEach((perFloor, index) => {
    const count = perFloor * residentialFloors;
    entrances.push({
      entrance: index + 1,
      count,
      firstNumber: nextNumber,
      lastNumber: nextNumber + count - 1,
    });
    nextNumber += count;
  });
  return {
    total: nextNumber - plan.startNumber,
    residentialFloors,
    firstNumber: plan.startNumber,
    lastNumber: nextNumber - 1,
    entrances,
  };
}

/**
 * Квартиры блока по порядку нумерации: подъезд за подъездом, внутри — снизу вверх,
 * на этаже — по позициям. Если у застройщика иначе — номера правятся после генерации (PLAN §7).
 */
export function generateUnits(plan: BlockPlan): GeneratedUnit[] {
  const issues = validateBlockPlan(plan);
  if (issues.length > 0) {
    throw new Error(
      `Неверные параметры генератора: ${issues.map((issue) => issue.code).join(", ")}`,
    );
  }
  const units: GeneratedUnit[] = [];
  let number = plan.startNumber;
  plan.unitsPerFloor.forEach((perFloor, index) => {
    for (let floor = plan.firstResidentialFloor; floor <= plan.floors; floor += 1) {
      for (let position = 1; position <= perFloor; position += 1) {
        units.push({ entrance: index + 1, floor, position, number: String(number) });
        number += 1;
      }
    }
  });
  return units;
}

function residentialFloorsOf(plan: BlockPlan): number {
  return plan.floors - plan.firstResidentialFloor + 1;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
