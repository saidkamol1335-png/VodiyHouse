import type { CalcCompareRow, CalcCompareTexts } from "@/components/CalcCompare";
import {
  type TotalContext,
  type TotalHead,
  type TotalRow,
  totalHead,
  totalRows,
} from "@/components/CalcTotal";
import type { Calculation } from "@/lib/calc/calculate";
import type { ExchangeRate } from "@/lib/calc/money";
import type { CalcProgram } from "@/lib/calc/programs";
import type { CalcView } from "@/lib/calc/view";
import { formatDate, formatPercent, formatRate } from "@/lib/format";
import { type CalcT, moneyIn, programName, termText } from "./calcText";

// Итог, сравнение и сноски калькулятора — из состояния (lib/calc/view). Строки скидки кабинет
// добавляет своей функцией decorate (сайт про скидки не знает, PLAN §3.13).

/** program — выбранная программа: процент скидки кабинет берёт из её условий, а не из чисел. */
export type DecorateRows = (
  rows: TotalRow[],
  calc: Calculation,
  context: TotalContext,
  program: CalcProgram,
) => TotalRow[];

export type CalcTotalView = {
  eyebrow: string;
  head: TotalHead | null;
  rows: TotalRow[];
  problem: string | null;
};

export function totalView<P extends CalcProgram>(
  view: CalcView<P>,
  context: TotalContext,
  decorate?: DecorateRows,
): CalcTotalView {
  const { t, locale } = context;
  const eyebrow = view.selected ? programName(view.selected, t, locale) : t("programs.title");
  if (!view.selected) return { eyebrow, head: null, rows: [], problem: t("programs.empty") };
  const result = view.result;
  if (!result) return { eyebrow, head: null, rows: [], problem: t("total.noPrice") };
  if (!result.ok) {
    const problem = {
      noPrice: "total.noPrice",
      noRate: "total.noRate",
      noTerms: "total.noTerms",
    } as const;
    return { eyebrow, head: null, rows: [], problem: t(problem[result.problem]) };
  }
  const calc = result.calculation;
  const rows = totalRows(calc, context);
  return {
    eyebrow,
    head: totalHead(calc, context),
    rows: decorate?.(rows, calc, context, view.selected.program) ?? rows,
    problem: null,
  };
}

/** Сноски итога: «иллюстративный», «Условия актуальны на», курс — если считали через него. */
export function footnotes<P extends CalcProgram>(
  view: CalcView<P>,
  context: { t: CalcT; rate: ExchangeRate | null; actualAt: string | null },
): string[] {
  const { t, rate } = context;
  const notes = [t("total.disclaimer")];
  // «Актуальны на» у программы — позднее из её правки и отметки «Условия проверены» (Р5).
  const actual = [view.selected?.updatedAt, context.actualAt]
    .filter((date): date is string => Boolean(date))
    .reduce<string | null>((latest, date) => (latest && latest > date ? latest : date), null);
  if (actual) notes.push(t("total.actual", { date: formatDate(new Date(actual)) }));
  const calc = view.result?.ok ? view.result.calculation : null;
  const converted =
    calc && (calc.currency !== view.price.currency || view.outCurrency !== calc.currency);
  if (rate && converted) {
    const date = formatDate(new Date(rate.date));
    notes.push(t("total.rate", { source: rate.source, rate: formatRate(rate.usdUzs), date }));
  }
  return notes;
}

export function compareRows<P extends CalcProgram>(
  view: CalcView<P>,
  context: TotalContext,
): { rows: CalcCompareRow[]; note: string | null } {
  const { t, locale, out, rate } = context;
  if (!view.comparison) return { rows: [], note: null };
  const optionOf = (program: P) => view.options.find((option) => option.program === program);
  const rows = view.comparison.rows.map(
    ({ program, calculation: calc, cheapest, lowestPayment }) => {
      const option = optionOf(program)!;
      const money = (amount: number) => moneyIn(amount, calc.currency, out, rate, locale);
      return {
        id: option.id,
        name: programName(option, t, locale),
        down: formatPercent(calc.downPct),
        term: calc.months > 0 ? termText(calc.months, t) : t("compare.none"),
        payment:
          calc.method === null
            ? t("compare.now")
            : t("compare.perMonth", { amount: money(calc.firstPayment) }),
        total: money(calc.total),
        totalShort: t("compare.totalShort", { amount: money(calc.total) }),
        overpayment: money(calc.overpayment),
        cheapest,
        lowest: lowestPayment,
        selected: option.id === view.selected?.id,
      };
    },
  );
  const missing = view.comparison.unavailable.map((program) => optionOf(program)).filter(Boolean);
  const names = missing.map((option) => programName(option!, t, locale)).join(", ");
  return { rows, note: names ? t("compare.unavailable", { names }) : null };
}

export function compareTexts(t: CalcT): CalcCompareTexts {
  return {
    program: t("compare.program"),
    down: t("compare.down"),
    term: t("compare.term"),
    payment: t("compare.payment"),
    total: t("compare.total"),
    overpayment: t("compare.overpayment"),
    cheapest: t("compare.cheapest"),
    lowest: t("compare.lowest"),
  };
}
