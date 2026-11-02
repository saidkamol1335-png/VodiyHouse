// Список квартир настоящих ЖК (docs/zhk/<slug>/units.json) для `npm run content:import`: два вида записи —
// сетка как на снимке шахматки (стояки + этажи) и готовые строки. На выходе — строки для таблицы units.

export type UnitStatus = "free" | "reserved" | "sold";

export type UnitsLayout = { rooms: number; area: number; drawing?: string };

/** Номер, цена целиком, статус (f, r, s); null — стояка на этом этаже нет. */
type GridCell = [number: string, price: number, status: string] | null;

type GridBlock = {
  risers: string[];
  floors: Record<string, GridCell[]>;
  penthouses?: { floor: number; risers: (string | null)[]; units: GridCell[] };
};

type RowsBlock = {
  /** Номер, этаж, стояк, планировка, цена, цена за м², статус. */
  rows: [string, number, number, string | null, number | null, number | null, string][];
};

export type UnitsFile = {
  currency: "USD" | "UZS";
  layouts: Record<string, UnitsLayout>;
  /** Планировки блока без квартир в продаже (их нет в строках): порядок на странице. */
  blockLayouts?: Record<string, string[]>;
  /** Цена за м² по этажам из чек-листа: важнее цен квартир в строках. */
  pricePerM2ByFloor?: Record<string, number>;
  blocks: Record<string, GridBlock | RowsBlock>;
};

export type UnitRow = {
  number: string;
  floor: number;
  position: number;
  layout: string | null;
  price: number | null;
  pricePerM2: number | null;
  status: UnitStatus;
};

const STATUSES: Record<string, UnitStatus> = { f: "free", r: "reserved", s: "sold" };

function statusOf(code: string): UnitStatus {
  const status = STATUSES[code];
  if (!status) throw new Error(`Неизвестный статус квартиры: ${code}`);
  return status;
}

function gridRows(block: GridBlock): UnitRow[] {
  const rows: UnitRow[] = [];
  const addFloor = (floor: number, risers: (string | null)[], cells: GridCell[]) => {
    cells.forEach((cell, index) => {
      if (!cell) return;
      const [number, price, status] = cell;
      rows.push({
        number,
        floor,
        position: index + 1,
        layout: risers[index] ?? null,
        price,
        pricePerM2: null,
        status: statusOf(status),
      });
    });
  };
  for (const [floor, cells] of Object.entries(block.floors))
    addFloor(Number(floor), block.risers, cells);
  if (block.penthouses)
    addFloor(block.penthouses.floor, block.penthouses.risers, block.penthouses.units);
  return rows;
}

/** Квартиры блока одной строкой на квартиру. */
export function unitRows(block: GridBlock | RowsBlock): UnitRow[] {
  if ("rows" in block) {
    return block.rows.map(([number, floor, position, layout, price, pricePerM2, status]) => ({
      number,
      floor,
      position,
      layout,
      price,
      pricePerM2,
      status: statusOf(status),
    }));
  }
  return gridRows(block);
}

/** Квартиры блока для базы: цена — по этажу, если в файле есть цены по этажам. */
export function siteUnitRows(file: UnitsFile, blockName: string): UnitRow[] {
  const block = file.blocks[blockName];
  if (!block) return [];
  const rates = file.pricePerM2ByFloor;
  if (!rates) return unitRows(block);
  return unitRows(block).map((row) => {
    const rate = rates[row.floor];
    if (!rate) throw new Error(`Нет цены за м² для ${row.floor} этажа, блок ${blockName}`);
    return { ...row, price: null, pricePerM2: rate };
  });
}

/** Планировки блока в порядке показа: перечисленные заранее или встреченные в квартирах. */
export function blockLayoutKeys(file: UnitsFile, blockName: string): string[] {
  const listed = file.blockLayouts?.[blockName];
  if (listed) return listed;
  const block = file.blocks[blockName];
  if (!block) return [];
  return [...new Set(unitRows(block).flatMap((row) => (row.layout ? [row.layout] : [])))];
}
