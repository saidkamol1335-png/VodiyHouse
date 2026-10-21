// Колонки списка квартир (Н1) — одно место для шапки таблицы и colspan раскрытой строки: в 12.5
// добавится колонка галочки, и раскрытие не должно стать на колонку уже.
export const UNITS_LIST_COLUMNS = [
  "number",
  "entrance",
  "floor",
  "layout",
  "price",
  "finishing",
  "updated",
  "status",
] as const;

export type UnitsListColumn = (typeof UNITS_LIST_COLUMNS)[number];
