import type { Currency } from "./money";
import type { CalcStock } from "./priceSource";
import type { BilingualRecord } from "./records";

// ЖК, блоки, планировки и квартиры из функций базы (client_calc_screen — кабинет, site_calc_screen —
// сайт; private.calc_complexes) → стоимость для калькулятора. Числа numeric приходят и строкой.

export type LayoutRecord = {
  id: string;
  rooms: number;
  area: number | string;
  price_from: number | string | null;
  available: boolean;
};
export type BlockRecord = { id: string; name: string; currency: Currency; layouts: LayoutRecord[] };
export type ComplexRecord = { id: string; name: unknown; blocks: BlockRecord[] };
export type UnitRecord = {
  id: string;
  number: string;
  floor: number;
  block_id: string;
  layout_id: string | null;
  rooms: number | null;
  area: number | string | null;
  price: number | string | null;
};
export type PriceHintRecord = { per_m2: number | string; currency: Currency } | null;

const numberOrNull = (value: number | string | null) => (value === null ? null : Number(value));

/** Название на двух языках; чужое — пустые строки (сайт не падает из-за одной записи). */
export function bilingualRecord(value: unknown): BilingualRecord {
  const record = (
    typeof value === "object" && value !== null ? value : {}
  ) as Partial<BilingualRecord>;
  return { ru: String(record.ru ?? ""), uz: String(record.uz ?? "") };
}

export function stockFrom(
  complexes: readonly ComplexRecord[],
  units: readonly UnitRecord[],
  hint: PriceHintRecord,
): CalcStock {
  const blocks = complexes.flatMap((complex) =>
    complex.blocks.map((block) => ({ complex, block })),
  );
  return {
    blocks: blocks.map(({ complex, block }) => ({
      id: block.id,
      name: block.name,
      complexId: complex.id,
      complexName: bilingualRecord(complex.name),
      currency: block.currency,
    })),
    layouts: blocks.flatMap(({ block }) =>
      block.layouts.map((layout) => ({
        id: layout.id,
        blockId: block.id,
        rooms: layout.rooms,
        area: Number(layout.area),
        priceFrom: numberOrNull(layout.price_from),
        available: layout.available,
      })),
    ),
    units: units.map((unit) => ({
      id: unit.id,
      number: unit.number,
      floor: unit.floor,
      blockId: unit.block_id,
      layoutId: unit.layout_id,
      rooms: unit.rooms,
      area: numberOrNull(unit.area),
      price: numberOrNull(unit.price),
    })),
    priceHint:
      hint && Number(hint.per_m2) > 0
        ? { perM2: Number(hint.per_m2), currency: hint.currency }
        : null,
  };
}
