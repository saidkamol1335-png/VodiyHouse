// Колонки списка квартир (Н1) — одно место для шапки таблицы и colspan раскрытой строки: колонка
// галочки (12.5) есть, только когда с выбранными можно что-то сделать.
export const UNITS_DATA_COLUMNS = [
  "number",
  "entrance",
  "floor",
  "layout",
  "price",
  "finishing",
  "updated",
  "status",
] as const;

export type UnitsListColumn = "select" | (typeof UNITS_DATA_COLUMNS)[number];

export function unitsListColumns(select: boolean): readonly UnitsListColumn[] {
  return select ? ["select", ...UNITS_DATA_COLUMNS] : UNITS_DATA_COLUMNS;
}
