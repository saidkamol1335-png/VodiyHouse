import type { Currency } from "@/lib/calc/money";
import { photoFrom, type CatalogPhoto, type PhotoRecord } from "@/lib/site/catalog/records";
import type { UnitStatus } from "@/lib/units/status";

// «Выбрать квартиру» на фасаде (фаза 4): ответ site_complex_picker(ЖК) и block_units(блок) как
// есть и преобразование в данные компонентов. Точки — проценты картинки [x, y], 0–100.

export type Point = [number, number];

export type UnitContour = { entrance: number; position: number; points: Point[] };

export type PickerRecord = {
  complex_id: string;
  facade: PhotoRecord | null;
  blocks: { id: string; contour: Point[] }[];
  plans: {
    id: string;
    block_id: string;
    entrance: number | null;
    floor_from: number;
    floor_to: number;
    image: PhotoRecord;
    contours: UnitContour[];
  }[];
};

export type FloorPlan = {
  id: string;
  blockId: string;
  /** null — план всего этажа (все подъезды). */
  entrance: number | null;
  floorFrom: number;
  floorTo: number;
  image: CatalogPhoto;
  contours: UnitContour[];
};

export type ComplexPicker = {
  facade: CatalogPhoto;
  /** Блоки с контуром на фасаде и хотя бы одним планом этажа — по порядку блоков ЖК. */
  blocks: { id: string; contour: Point[] }[];
  plans: FloorPlan[];
};

/**
 * Раздел есть, когда есть фасад и хотя бы один блок с контуром и планом (PLAN §7: «без фасада или
 * планов — раздел скрыт»). Блок без плана на фасад не выводится: нажать на него было бы некуда.
 */
export function pickerFrom(record: PickerRecord | null): ComplexPicker | null {
  if (!record?.facade) return null;
  const plans: FloorPlan[] = record.plans.map((plan) => ({
    id: plan.id,
    blockId: plan.block_id,
    entrance: plan.entrance,
    floorFrom: plan.floor_from,
    floorTo: plan.floor_to,
    image: photoFrom(plan.image),
    contours: plan.contours,
  }));
  const blocks = record.blocks.filter((block) => plans.some((plan) => plan.blockId === block.id));
  return blocks.length > 0 ? { facade: photoFrom(record.facade), blocks, plans } : null;
}

/** Строка block_units: цена — только у свободной. */
export type BlockUnitRecord = {
  unit_id: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layout_id: string | null;
  rooms: number | null;
  area: number | string | null;
  status: UnitStatus;
  price: number | string | null;
  currency: Currency;
};

export type PickerUnit = {
  id: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layoutId: string | null;
  rooms: number | null;
  area: number | null;
  status: UnitStatus;
  price: number | null;
  currency: Currency;
};

const numberOrNull = (value: number | string | null) => (value === null ? null : Number(value));

export function unitFrom(record: BlockUnitRecord): PickerUnit {
  return {
    id: record.unit_id,
    entrance: record.entrance,
    floor: record.floor,
    position: record.position,
    number: record.number,
    layoutId: record.layout_id,
    rooms: record.rooms,
    area: numberOrNull(record.area),
    status: record.status,
    price: numberOrNull(record.price),
    currency: record.currency,
  };
}
