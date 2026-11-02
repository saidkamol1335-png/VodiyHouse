import type { CabinetProgram } from "@vh/shared/calc/cabinet/discounts";
import { cabinetProgramFromRecord, type CabinetProgramRecord } from "@vh/shared/calc/cabinet/records";
import type { ExchangeRate } from "@vh/shared/calc/money";
import type { ProgramOption } from "@vh/shared/calc/options";
import { kindOf } from "@vh/shared/calc/programs";
import {
  type ComplexRecord,
  type PriceHintRecord,
  stockFrom,
  type UnitRecord,
} from "@vh/shared/calc/stockRecords";
import type { CalcData } from "@vh/shared/calc/view";
import { bilingualFrom } from "../bilingual";

// Ответ client_calc_screen() (20261024100000_payment_programs.sql) → данные «Расчёта для клиента».

export type CalcDeveloperRecord = {
  id: string;
  slug: string;
  name: string;
  checked_at: string | null;
  price_hint: PriceHintRecord;
  programs: (CabinetProgramRecord & { bank: unknown; updated_at: string })[];
  complexes: ComplexRecord[];
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
      data: {
        options: current.programs.map(optionFrom),
        stock: stockFrom(current.complexes, current.units, current.price_hint),
        rate,
      },
    },
  };
}
