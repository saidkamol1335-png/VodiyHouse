import {
  type BilingualRecord,
  programFromRecord,
  type SiteProgramRecord,
  type SiteTierRecord,
} from "../records";
import type { CabinetProgram } from "./discounts";

// Запись программы для кабинета (payment_program_panels: строка payment_programs целиком, со
// скидками) → программа lib/calc/cabinet. Сайт этот модуль не импортирует (discounts.test.ts).

export type CabinetTierRecord = SiteTierRecord & { discount_pct: number };

export type CabinetProgramRecord = Omit<SiteProgramRecord, "tiers"> & {
  developer_id: string;
  bank_id: number | null;
  discount_pct: number | null;
  tiers: CabinetTierRecord[];
  is_active: boolean;
  sort: number;
  created_at: string;
  /** «Условия для клиента» — только в кабинете: на сайт текст не уходит (private.site_program). */
  conditions: BilingualRecord | null;
};

export function cabinetProgramFromRecord(record: CabinetProgramRecord): CabinetProgram {
  const program = programFromRecord(record);
  if (program.type === "full")
    return { type: "full", discountPct: Number(record.discount_pct ?? 0) };
  if (program.method !== "tiers") return program;
  return {
    ...program,
    tiers: program.tiers.map((tier, index) => ({
      ...tier,
      discountPct: Number(record.tiers[index]?.discount_pct ?? 0),
    })),
  };
}
