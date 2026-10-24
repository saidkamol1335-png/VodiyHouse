import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { cabinetProgramFromRecord, type CabinetProgramRecord } from "@/lib/calc/cabinet/records";
import type { Currency, ExchangeRate } from "@/lib/calc/money";
import type { ProgramOption } from "@/lib/calc/options";
import type { CalcStock } from "@/lib/calc/priceSource";
import { kindOf } from "@/lib/calc/programs";
import type { CalcData } from "@/lib/calc/view";
import { bilingualFrom } from "../bilingual";

// Ответ client_calc_screen() (20261024100000_payment_programs.sql) → данные «Расчёта для клиента».

type LayoutRecord = {
  id: string;
  rooms: number;
  area: number | string;
  price_from: number | string | null;
  available: boolean;
};
type BlockRecord = { id: string; name: string; currency: Currency; layouts: LayoutRecord[] };
type UnitRecord = {
  id: string;
  number: string;
  floor: number;
  block_id: string;
  layout_id: string | null;
  rooms: number | null;
  area: number | string | null;
  price: number | string | null;
};

export type CalcDeveloperRecord = {
  id: string;
  slug: string;
  name: string;
  checked_at: string | null;
  price_hint: { per_m2: number | string; currency: Currency } | null;
  programs: (CabinetProgramRecord & { bank: unknown; updated_at: string })[];
  complexes: { id: string; name: unknown; blocks: BlockRecord[] }[];
  units: UnitRecord[];
};

export type ClientCalcRecord = {
  developers: { id: string; slug: string; name: string }[];
  current: CalcDeveloperRecord | null;
};

export type CalcDeveloper = { id: string; slug: string; name: string };

export type ClientCalcScreen = {
  developers: CalcDeveloper[];
  current: (CalcDeveloper & { checkedAt: string | null; data: CalcData<CabinetProgram> }) | null;
};

const numberOrNull = (value: number | string | null) => (value === null ? null : Number(value));

function optionFrom(
  record: CalcDeveloperRecord["programs"][number],
): ProgramOption<CabinetProgram> {
  return {
    id: record.id,
    kind: kindOf(record),
    bankName: record.bank ? bilingualFrom(record.bank) : null,
    blocksScope: record.blocks_scope,
    blockIds: record.block_ids,
    updatedAt: record.updated_at,
    program: cabinetProgramFromRecord(record),
  };
}

function stockFrom(record: CalcDeveloperRecord): CalcStock {
  const blocks = record.complexes.flatMap((complex) =>
    complex.blocks.map((block) => ({ complex, block })),
  );
  return {
    blocks: blocks.map(({ complex, block }) => ({
      id: block.id,
      name: block.name,
      complexId: complex.id,
      complexName: bilingualFrom(complex.name),
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
    units: record.units.map((unit) => ({
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
      record.price_hint && Number(record.price_hint.per_m2) > 0
        ? { perM2: Number(record.price_hint.per_m2), currency: record.price_hint.currency }
        : null,
  };
}

export function clientCalcFrom(
  record: ClientCalcRecord,
  rate: ExchangeRate | null,
): ClientCalcScreen {
  const current = record.current;
  return {
    developers: record.developers.map(({ id, slug, name }) => ({ id, slug, name })),
    current: current && {
      id: current.id,
      slug: current.slug,
      name: current.name,
      checkedAt: current.checked_at,
      data: { options: current.programs.map(optionFrom), stock: stockFrom(current), rate },
    },
  };
}
