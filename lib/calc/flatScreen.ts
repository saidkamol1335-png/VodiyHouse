import type { Currency } from "./money";
import type { PriceMode } from "./params";
import type { CalcProgram } from "./programs";
import {
  type BilingualRecord,
  rateFromRecord,
  type RateRecord,
  type SiteProgramRecord,
} from "./records";
import { siteOptionFrom } from "./siteOptions";
import { bilingualRecord, stockFrom } from "./stockRecords";
import type { CalcData } from "./view";

// Ответ site_layout_calc() (20261024100000_payment_programs.sql) → «Расчёт для этой квартиры»
// (шаг 2.7): планировка опубликованного ЖК, её свободные квартиры с ценой и программы её блока —
// без полей скидки (PLAN §3.13). Тот же преобразователь у стенда (DEMO) и у страницы ЖК (фаза 3).

export type FlatUnitRecord = {
  id: string;
  number: string;
  floor: number;
  price: number | string | null;
};

export type FlatCalcRecord = {
  rate: RateRecord | null;
  developer: { name: string; checked_at: string | null };
  complex: { id: string; name: unknown };
  block: { id: string; name: string; currency: Currency };
  layout: {
    id: string;
    rooms: number;
    area: number | string;
    price_from: number | string | null;
    available: boolean;
    /** Путь чертежа в бакете media; нет чертежа — null. */
    drawing: string | null;
  };
  units: FlatUnitRecord[];
  programs: SiteProgramRecord[];
};

export type FlatCalcScreen = {
  developerName: string;
  checkedAt: string | null;
  complexName: BilingualRecord;
  blockName: string;
  layout: { id: string; rooms: number; area: number; drawing: string | null };
  /** Есть свободная квартира с ценой — выбор квартиры; нет — «цена от» планировки. */
  modes: readonly PriceMode[];
  data: CalcData<CalcProgram>;
};

export function flatCalcFrom(record: FlatCalcRecord): FlatCalcScreen {
  const { block, layout } = record;
  const area = Number(layout.area);
  const complex = { id: record.complex.id, name: record.complex.name };
  const layoutRecord = { ...layout, area };
  const units = record.units.map((unit) => ({
    ...unit,
    block_id: block.id,
    layout_id: layout.id,
    rooms: layout.rooms,
    area,
  }));
  return {
    developerName: record.developer.name,
    checkedAt: record.developer.checked_at,
    complexName: bilingualRecord(record.complex.name),
    blockName: block.name,
    layout: { id: layout.id, rooms: layout.rooms, area, drawing: layout.drawing },
    modes: units.some((unit) => Number(unit.price) > 0) ? ["unit"] : ["layout"],
    data: {
      options: record.programs.map(siteOptionFrom),
      stock: stockFrom(
        [{ ...complex, blocks: [{ ...block, layouts: [layoutRecord] }] }],
        units,
        null,
      ),
      rate: rateFromRecord(record.rate),
    },
  };
}
