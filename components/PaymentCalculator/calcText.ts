import type { useTranslations } from "next-intl";
import { type Currency, convertMoney, type ExchangeRate } from "@/lib/calc/money";
import type { ProgramOption } from "@/lib/calc/options";
import type { CalcStock } from "@/lib/calc/priceSource";
import { type CalcProgram, isTiered } from "@/lib/calc/programs";
import { formatPercent, formatPrice, formatPriceShort, termParts } from "@/lib/format";

// Тексты калькулятора (раздел calc — сайт и кабинет, ru и uz): названия программ, сроки, суммы
// в валюте итога. Слова «скидка» здесь нет — его добавляет только кабинет (PLAN §3.13).

export type CalcT = ReturnType<typeof useTranslations<"calc">>;
export type CalcLocale = "ru" | "uz";

export function termText(months: number, t: CalcT): string {
  const { unit, count } = termParts(months);
  return unit === "years" ? t("years", { count }) : t("months", { count });
}

/** Сумма в валюте итога; нет курса — в своей валюте. */
export function moneyIn(
  amount: number,
  from: Currency,
  to: Currency,
  rate: ExchangeRate | null,
  locale: CalcLocale,
): string {
  const converted = convertMoney(amount, from, to, rate);
  return converted === null
    ? formatPrice(amount, from, locale)
    : formatPrice(converted, to, locale);
}

/** Коротко для тесных мест: «22,5 млн сум»; доллары — как есть. */
export function shortIn(
  amount: number,
  from: Currency,
  to: Currency,
  rate: ExchangeRate | null,
  locale: CalcLocale,
): string {
  const converted = convertMoney(amount, from, to, rate);
  return converted === null
    ? formatPriceShort(amount, from, locale)
    : formatPriceShort(converted, to, locale);
}

/** «≈ 17 847 000 сум» — та же сумма в другой валюте; без курса — null. */
export function approxIn(
  amount: number,
  from: Currency,
  shown: Currency,
  rate: ExchangeRate | null,
  locale: CalcLocale,
): string | null {
  const other: Currency = shown === "USD" ? "UZS" : "USD";
  const converted = convertMoney(amount, from, other, rate);
  return converted === null ? null : formatPrice(converted, other, locale);
}

/** Крупно в карточке: банк или вид программы. */
export function programTitle(option: ProgramOption<CalcProgram>, t: CalcT, locale: CalcLocale) {
  return option.bankName ? option.bankName[locale] : t(`kinds.${option.kind}`);
}

/** Для итога, сравнения и Telegram: у банка две программы — «Ipoteka Bank · Ипотека». */
export function programName(option: ProgramOption<CalcProgram>, t: CalcT, locale: CalcLocale) {
  const kind = t(`kinds.${option.kind}`);
  return option.bankName ? `${option.bankName[locale]} · ${kind}` : kind;
}

function rateRange(rates: readonly number[]): string {
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? formatPercent(min) : `${formatPercent(min)}–${formatPercent(max)}`;
}

/** Строка условий под названием: «от 30% · до 36 мес. · без наценки». */
export function programNote(option: ProgramOption<CalcProgram>, t: CalcT): string {
  const { program } = option;
  if (program.type === "full") return t("programs.full");
  if (isTiered(program)) {
    const first = program.tiers[0];
    return t("programs.scheme", {
      down: formatPercent(first?.minDownPct ?? 0),
      term: termText(first?.maxMonths ?? 0, t),
    });
  }
  const longest = Math.max(...program.terms.map((row) => row.months), 0);
  const values = {
    down: formatPercent(program.minDownPct),
    term: termText(longest, t),
    rate: rateRange(program.terms.map((row) => row.ratePct)),
  };
  return program.method === "markup" ? t("programs.markup", values) : t("programs.bank", values);
}

/** Где действует программа, ограниченная блоками: «Shodlik, блок A». */
export function blocksNote(
  option: ProgramOption<CalcProgram>,
  stock: CalcStock,
  t: CalcT,
  locale: CalcLocale,
): string | null {
  if (option.blocksScope === "all") return null;
  const names = stock.blocks
    .filter((block) => option.blockIds.includes(block.id))
    .map((block) =>
      t("programs.blocks", { complex: block.complexName[locale], block: block.name }),
    );
  return names.length > 0 ? names.join("; ") : null;
}
