import type { Currency } from "@vh/shared/calc/money";
import { photoFrom, type CatalogPhoto, type PhotoRecord } from "@/lib/site/catalog/records";
import type { UnitStatus } from "@vh/shared/units/status";

// «Выбрать квартиру» на фасаде (фаза 4): ответ site_complex_picker(ЖК) и block_units(блок) как
// есть и преобразование в данные компонентов. Точки — проценты картинки [x, y], 0–100.

export type Point = [number, number];

/** open — есть квартиры; layouts — блок без списка, ведёт к планировкам; soon — серый, не кликается. */
export type PickerBlockState = "open" | "layouts" | "soon";

export type UnitContour = { entrance: number; position: number; points: Point[] };

export type PickerRecord = {
  complex_id: string;
  facade: PhotoRecord | null;
  blocks: { id: string; contour: Point[]; state?: PickerBlockState }[];
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
  /** Блоки с контуром на фасаде: с квартирами — только при плане этажа, остальные — всегда. */
  blocks: { id: string; contour: Point[]; state: PickerBlockState }[];
  plans: FloorPlan[];
};

/**
 * Раздел есть, когда есть фасад и хотя бы один блок, на который можно нажать (PLAN §7: «без фасада
 * или планов — раздел скрыт»). Блок с квартирами без плана на фасад не выводится: нажать было бы некуда.
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
  const blocks = record.blocks
    .map((block) => ({ ...block, state: block.state ?? ("open" as const) }))
    .filter((block) => block.state !== "open" || plans.some((plan) => plan.blockId === block.id));
  return blocks.some((block) => block.state !== "soon") ? { facade: photoFrom(record.facade), blocks, plans } : null;
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
  /** false — свободна, но неполная планировка или нет цены: на сайте серая. */
  sellable?: boolean;
};

/** pending — свободная, которую пока нельзя выбрать: серая, без цены, «Цена уточняется». */
export type PickerUnitStatus = UnitStatus | "pending";

export type PickerUnit = {
  id: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layoutId: string | null;
  rooms: number | null;
  area: number | null;
  status: PickerUnitStatus;
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
    status: record.status === "free" && record.sellable === false ? "pending" : record.status,
    price: numberOrNull(record.price),
    currency: record.currency,
  };
}
