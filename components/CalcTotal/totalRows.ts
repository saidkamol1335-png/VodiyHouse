import {
  type CalcLocale,
  type CalcT,
  approxIn,
  moneyIn,
  shortIn,
  termText,
} from "@/components/PaymentCalculator/calcText";
import type { Calculation } from "@/lib/calc/calculate";
import type { Currency, ExchangeRate } from "@/lib/calc/money";
import { formatPercent } from "@/lib/format";

// Строки итога (мокапы SiteCalc, MobFlatTerm, MobFlatBank): по методу программы — остаток или
// кредит, наценка или проценты, разовые, переплата, итог. Те же строки идут в текст для Telegram.

export type TotalRow = {
  key: string;
  label: string;
  note?: string;
  value: string;
  tone?: "accent" | "minus";
};

/**
 * approx — «≈ 17 847 000 сум»: та же сумма в другой валюте; без курса — null. short — для тесной
 * липкой полосы телефона: «22,5 млн сум» (мокап MobFlatBank).
 */
export type TotalHead = { label: string; value: string; approx: string | null; short: string };

export type TotalContext = {
  out: Currency;
  rate: ExchangeRate | null;
  t: CalcT;
  locale: CalcLocale;
};

const money = (amount: number, calc: Calculation, context: TotalContext) =>
  moneyIn(amount, calc.currency, context.out, context.rate, context.locale);

/** Крупная строка: платёж в месяц, первый платёж (дифференцированный) или вся сумма сразу. */
export function totalHead(calc: Calculation, context: TotalContext): TotalHead {
  const { t } = context;
  const amount = calc.method === null ? calc.total : calc.firstPayment;
  const label =
    calc.method === null
      ? t("total.now")
      : calc.method === "differentiated"
        ? t("total.first")
        : t("total.monthly");
  const approx = approxIn(amount, calc.currency, context.out, context.rate, context.locale);
  return {
    label,
    value: money(amount, calc, context),
    approx: approx === null ? null : t("total.approx", { amount: approx }),
    short: shortIn(amount, calc.currency, context.out, context.rate, context.locale),
  };
}

function middleRows(calc: Calculation, context: TotalContext): TotalRow[] {
  const { t } = context;
  const term = termText(calc.months, t);
  const rate = formatPercent(calc.ratePct ?? 0);
  if (calc.method === "tiers") {
    const note = t("total.restNote", { term });
    return [
      { key: "rest", label: t("total.rest"), note, value: money(calc.financed, calc, context) },
    ];
  }
  const loan = calc.method === "markup" ? t("total.rest") : t("total.loan");
  const extra =
    calc.method === "markup"
      ? { label: t("total.markup"), note: t("total.markupNote", { rate, term }) }
      : { label: t("total.interest"), note: t("total.interestNote", { rate, term }) };
  return [
    { key: "loan", label: loan, value: money(calc.financed, calc, context) },
    { key: "extra", ...extra, value: money(calc.extra, calc, context) },
    ...calc.fees.map((fee) => ({
      key: `fee-${fee.name}`,
      label: t(`total.fees.${fee.name}`),
      value: money(fee.amount, calc, context),
    })),
    {
      key: "overpayment",
      label: t("total.overpayment"),
      value: money(calc.overpayment, calc, context),
    },
  ];
}

export function totalRows(calc: Calculation, context: TotalContext): TotalRow[] {
  const { t } = context;
  const price: TotalRow = {
    key: "price",
    label: t("total.price"),
    value: money(calc.price, calc, context),
  };
  const total: TotalRow = {
    key: "total",
    label: t("total.total"),
    value: money(calc.total, calc, context),
    tone: "accent",
  };
  if (calc.method === null) return [price, total];
  const down: TotalRow = {
    key: "down",
    label: t("total.down", { pct: formatPercent(calc.downPct) }),
    value: money(calc.down, calc, context),
  };
  return [price, down, ...middleRows(calc, context), total];
}
