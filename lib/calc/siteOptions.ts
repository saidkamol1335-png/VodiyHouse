import type { ProgramOption } from "./options";
import { type CalcProgram, kindOf } from "./programs";
import { programFromRecord, type SiteProgramRecord } from "./records";

// Запись программы сайта (site_payment_programs: без полей скидки, PLAN §3.13) → программа
// калькулятора. Кабинетная пара — lib/admin/calc/screen.ts (со скидками).

export function siteOptionFrom(record: SiteProgramRecord): ProgramOption<CalcProgram> {
  return {
    id: record.id,
    kind: kindOf(record),
    bankName: record.bank ? { ru: record.bank.ru, uz: record.bank.uz } : null,
    blocksScope: record.blocks_scope,
    blockIds: record.block_ids,
    updatedAt: record.updated_at,
    program: programFromRecord(record),
  };
}
