// CSV квартир ЖК перед окончательным удалением из архива (шаг 3.13, PLAN §3а «Архив»): то, что
// руководитель сохраняет у себя. Точка с запятой и BOM — Excel открывает по двойному щелчку.

export type ArchiveUnit = {
  complex: string;
  block: string;
  entrance: number;
  floor: number;
  number: string;
  rooms: number | null;
  area: number | null;
  price: number | null;
  price_per_m2: number | null;
  currency: string;
  status: string;
};

const COLUMNS = ["ЖК", "Блок", "Подъезд", "Этаж", "Квартира", "Комнат", "Площадь, м²", "Цена", "Цена за м²", "Валюта", "Статус"];
const STATUSES: Record<string, string> = { free: "свободна", reserved: "бронь", sold: "продана" };

// Ячейка, начатая «=», «+», «-», «@», — формула в Excel: текст из базы ею не станет.
const cell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

// Excel с русскими настройками читает «28.5» как дату (28 мая): дробные — через запятую.
const decimal = (value: number | null) => (value === null ? null : String(value).replace(".", ","));

export function archiveUnitsCsv(units: readonly ArchiveUnit[]): string {
  const rows = units.map((unit) =>
    [
      unit.complex,
      unit.block,
      unit.entrance,
      unit.floor,
      unit.number,
      unit.rooms,
      decimal(unit.area),
      decimal(unit.price),
      decimal(unit.price_per_m2),
      unit.currency,
      STATUSES[unit.status] ?? unit.status,
    ]
      .map(cell)
      .join(";"),
  );
  return `﻿${[COLUMNS.join(";"), ...rows].join("\r\n")}\r\n`;
}
