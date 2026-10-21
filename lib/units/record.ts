// Квартира в кабинете — из block_unit_rows (список блока одним jsonb) и из ответов add_unit /
// update_unit (строка таблицы). Разбор строгий: чужая форма — исключение, а не «пустой список».

import { isUnitStatus, type UnitStatus } from "./status";

export type UnitRecord = {
  id: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layoutId: string | null;
  /** Цена целиком или за м² — ровно одна или ни одной (ограничение таблицы). */
  price: number | null;
  pricePerM2: number | null;
  /** null — отделка блока («как в блоке»). */
  finishingId: number | null;
  status: UnitStatus;
  updatedAt: string;
  /** Кто менял последним — только в block_unit_rows; у строки из add_unit и update_unit нет. */
  updatedByName: string | null;
};

type Row = Record<string, unknown>;

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function int(row: Row, key: string): number {
  const value = Number(row[key]);
  if (!Number.isInteger(value)) throw new Error(`units: ${key} — не целое`);
  return value;
}

function optionalNumber(row: Row, key: string): number | null {
  const value = row[key];
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`units: ${key} — не число`);
  return parsed;
}

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`units: ${key} — не строка`);
  return value;
}

/** Время правки: строка, которую понимает Date, — иначе «обновлено …» уронило бы весь список. */
function timestamp(row: Row, key: string): string {
  const value = text(row, key);
  if (!Number.isFinite(Date.parse(value))) throw new Error(`units: ${key} — не время`);
  return value;
}

const optionalText = (row: Row, key: string): string | null =>
  typeof row[key] === "string" ? (row[key] as string) : null;

export function parseUnitRecord(value: unknown): UnitRecord {
  if (!isRow(value)) throw new Error("units: строка квартиры — не объект");
  const status = value.status;
  if (!isUnitStatus(status)) throw new Error("units: неизвестный статус");
  return {
    id: text(value, "id"),
    entrance: int(value, "entrance"),
    floor: int(value, "floor"),
    position: int(value, "position"),
    number: text(value, "number"),
    layoutId: optionalText(value, "layout_id"),
    price: optionalNumber(value, "price"),
    pricePerM2: optionalNumber(value, "price_per_m2"),
    finishingId: optionalNumber(value, "finishing_id"),
    status,
    updatedAt: timestamp(value, "updated_at"),
    updatedByName: optionalText(value, "updated_by_name"),
  };
}

/** Ответ block_unit_rows: массив строк в порядке номеров. */
export function parseUnitRecords(value: unknown): UnitRecord[] {
  if (!Array.isArray(value)) throw new Error("units: список квартир — не массив");
  return value.map(parseUnitRecord);
}
