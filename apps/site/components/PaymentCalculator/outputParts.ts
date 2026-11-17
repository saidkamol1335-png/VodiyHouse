import type { CalcCompareRow, CalcCompareTexts } from "@/components/CalcCompare";
import {
  type TotalContext,
  type TotalHead,
  type TotalRow,
  totalHead,
  totalRows,
} from "@/components/CalcTotal";
import type { Calculation } from "@vh/shared/calc/calculate";
import type { ExchangeRate } from "@vh/shared/calc/money";
import type { CalcHintSlug } from "@vh/shared/calc/hints";
import type { CalcProgram, ProgramKind } from "@vh/shared/calc/programs";
import type { CalcView } from "@vh/shared/calc/view";
import { fullBenefitPct } from "@vh/shared/calc/fullBenefit";
import { formatDate, formatMinus, formatPercent, formatRate } from "@vh/shared/format";
import { type CalcT, moneyIn, programName, termText } from "@vh/shared/calc/text";

// Итог, сравнение и сноски калькулятора — из состояния (lib/calc/view). Строки скидки кабинет
// добавляет своей функцией decorate; сайт знает одну скидку — за 100 % оплату, и только когда база её
// отдала («Скидки на сайте» включены, правки 15.11, п. 21) — fullBenefitRows.

/** program — выбранная программа: процент скидки кабинет берёт из её условий, а не из чисел. */
export type DecorateRows = (
  rows: TotalRow[],
  calc: Calculation,
  context: TotalContext,
  program: CalcProgram,
) => TotalRow[];

export type CalcTotalView = {
  eyebrow: string;
  /** «?» к виду выбранной программы; у «100% оплаты» пояснять нечего. */
  eyebrowHint?: CalcHintSlug;
  head: TotalHead | null;
  rows: TotalRow[];
  problem: string | null;
};

const KIND_HINTS: Readonly<Record<ProgramKind, CalcHintSlug | undefined>> = {
  full: undefined,
  scheme: "installment",
  markup: "installment-markup",
  bank: "bank-installment",
  mortgage: "mortgage",
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
    eyebrowHint: KIND_HINTS[view.selected.kind],
    head: totalHead(calc, context),
    rows: (decorate ?? fullBenefitRows)(rows, calc, context, view.selected.program),
    problem: null,
  };
}

/**
 * «100% оплата» с выгодой (правки 15.11, п. 21): вместо «Стоимость» — «Цена по прайсу», «Выгода при 100%
 * оплате · N%» и «Цена при 100% оплате»; разница — от тех же чисел, что итог. Без выгоды — строки как были.
 */
export const fullBenefitRows: DecorateRows = (rows, calc, context, program) => {
  const pct = fullBenefitPct(program);
  if (pct <= 0 || calc.programPrice >= calc.price) return rows;
  const { t } = context;
  const money = (amount: number) => moneyIn(amount, calc.currency, context.out, context.rate, context.locale);
  const benefit: TotalRow = {
    key: "benefit",
    label: t("total.fullBenefit"),
    note: formatPercent(pct),
    value: formatMinus(money(calc.price - calc.programPrice)),
    tone: "minus",
  };
  const fullPrice: TotalRow = { key: "programPrice", label: t("total.fullPrice"), value: money(calc.programPrice) };
  return rows.flatMap((row) => (row.key === "price" ? [{ ...row, label: t("total.listPrice") }, benefit, fullPrice] : [row]));
};

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
      const pct = fullBenefitPct(program);
      const name = programName(option, t, locale);
      return {
        id: option.id,
        name: pct > 0 ? t("compare.fullBenefit", { name, pct: formatPercent(pct) }) : name,
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
