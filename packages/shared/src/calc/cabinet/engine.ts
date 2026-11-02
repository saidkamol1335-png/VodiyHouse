import { baseDownOptions, type CalcEngine, type DownOption, type ProgramOption } from "../options";
import {
  type CabinetFullProgram,
  type CabinetProgram,
  calculateWithDiscount,
  compareWithDiscount,
  discountPctOf,
} from "./discounts";

// Движок «Расчёта для клиента» (Р1): цена по программе — со скидкой за взнос и за 100 %;
// у схемы чипы взноса — её ступени и «100%», который ведёт в программу «100% оплата».

function fullOptionOf(options: readonly ProgramOption<CabinetProgram>[]) {
  return options.find(
    (option): option is ProgramOption<CabinetFullProgram> => option.program.type === "full",
  );
}

export const CABINET_ENGINE: CalcEngine<CabinetProgram> = {
  calculate: calculateWithDiscount,
  compare: compareWithDiscount,
  downOptions: (option, options) => {
    const base = baseDownOptions(option.program);
    const full = fullOptionOf(options);
    if (option.program.type === "full" || option.program.method !== "tiers" || !full) return base;
    const toFull: DownOption = { downPct: 100, maxMonths: null, targetId: full.id };
    return [...base, toFull];
  },
};

/** Скидка чипа взноса, %: ступень схемы или «100%» программы «100% оплата». */
export function downOptionDiscountPct(
  option: ProgramOption<CabinetProgram>,
  down: DownOption,
  options: readonly ProgramOption<CabinetProgram>[],
): number {
  if (down.targetId !== null) {
    const target = options.find((item) => item.id === down.targetId);
    return target ? discountPctOf(target.program, null) : 0;
  }
  const { program } = option;
  if (program.type === "full" || program.method !== "tiers") return 0;
  const index = program.tiers.findIndex((tier) => tier.minDownPct === down.downPct);
  return index < 0 ? 0 : discountPctOf(program, index);
}
