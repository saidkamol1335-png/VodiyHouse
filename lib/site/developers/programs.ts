import type { ProgramOption } from "@/lib/calc/options";
import { type CalcProgram, kindOf } from "@/lib/calc/programs";
import type { CatalogProgram } from "@/lib/site/catalog/records";

/**
 * Программы застройщика из каталога → карточки «Условий покупки» (шаг 3.15): те же названия и
 * строка условий, что у калькулятора (lib/calc/text.ts), без скидок (PLAN §3.13).
 */
export function programOptionsOf(programs: readonly CatalogProgram[]): ProgramOption<CalcProgram>[] {
  return programs.map(({ id, program, bank, blocksScope, blockIds }) => ({
    id,
    kind: kindOf({ type: program.type, method: "method" in program ? program.method : null }),
    bankName: bank ? { ru: bank.ru, uz: bank.uz } : null,
    blocksScope,
    blockIds,
    updatedAt: null,
    program,
  }));
}
