import type { useTranslations } from "next-intl";
import type { TotalContext, TotalRow } from "@/components/CalcTotal";
import { moneyIn } from "@/components/PaymentCalculator/calcText";
import type { CalcExtras } from "@/components/PaymentCalculator/inputParts";
import type { DecorateRows } from "@/components/PaymentCalculator/outputParts";
import type { Calculation } from "@/lib/calc/calculate";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { discountPctOf } from "@/lib/calc/cabinet/discounts";
import { downOptionDiscountPct } from "@/lib/calc/cabinet/engine";
import type { ProgramOption } from "@/lib/calc/options";
import { formatPercent } from "@/lib/format";

// Скидки «Расчёта для клиента» (Р1, мокап r1): строки «Цена по прайсу / Скидка за взнос 50% /
// Цена со скидкой», «→ −6%» у чипов, «скидка 12%» у карточек. Только кабинет: сайт этот модуль
// не импортирует, тексты — в admin (на узбекском — только строки для Telegram).

export type DiscountT = ReturnType<typeof useTranslations<"admin.calcTelegram">>;
export type AdminCalcT = ReturnType<typeof useTranslations<"admin.calc">>;

const roundPct = (value: number) => Math.round(value * 10) / 10;

/** Строки скидки после «Цены по прайсу»; без скидки — строки как у сайта. */
export function discountDecorator(labels: DiscountT): DecorateRows {
  return (rows: TotalRow[], calc: Calculation, context: TotalContext) => {
    if (calc.programPrice >= calc.price) return rows;
    const money = (amount: number) =>
      moneyIn(amount, calc.currency, context.out, context.rate, context.locale);
    const pct = formatPercent(roundPct((1 - calc.programPrice / calc.price) * 100));
    const discount: TotalRow = {
      key: "discount",
      label:
        calc.method === null
          ? labels("discountFull")
          : labels("discountDown", { pct: formatPercent(calc.downPct) }),
      note: pct,
      value: `−${money(calc.price - calc.programPrice)}`,
      tone: "minus",
    };
    const discounted: TotalRow = {
      key: "programPrice",
      label: labels("discountedPrice"),
      value: money(calc.programPrice),
    };
    return rows.flatMap((row) =>
      row.key === "price" ? [{ ...row, label: labels("listPrice") }, discount, discounted] : [row],
    );
  };
}

/** У карточек: «100% оплата · скидка 12%», схема — «−12% при 100%» (мокап r1). */
function programSuffix(
  option: ProgramOption<CabinetProgram>,
  options: readonly ProgramOption<CabinetProgram>[],
  t: AdminCalcT,
): string | null {
  const { program } = option;
  if (program.type === "full") {
    const pct = discountPctOf(program, null);
    return pct > 0 ? t("fullNote", { pct: formatPercent(pct) }) : null;
  }
  if (program.method !== "tiers") return null;
  const full = options.find((item) => item.program.type === "full");
  const pct = full ? discountPctOf(full.program, null) : 0;
  return pct > 0 ? t("schemeNote", { pct: formatPercent(pct) }) : null;
}

export function cabinetExtras(
  options: readonly ProgramOption<CabinetProgram>[],
  t: AdminCalcT,
): CalcExtras<CabinetProgram> {
  return {
    programSuffix: (option) => programSuffix(option, options, t),
    downBadge: (option, down) => {
      const pct = downOptionDiscountPct(option, down, options);
      return pct > 0 ? t("downDiscount", { pct: formatPercent(pct) }) : null;
    },
    downTitle: t("optionsTitle"),
  };
}
