import type { useTranslations } from "next-intl";
import type { ProgramItem, ProgramPanel } from "@/lib/admin/programs/types";
import { programExample } from "@/lib/calc/example";
import type { ExchangeRate } from "@/lib/calc/money";
import { formatDate, formatPercent, formatPrice, initialsOf, termParts } from "@/lib/format";

// Тексты карточки программы (мокап CabProg): чипы, строки «Взнос / Валюта / Блоки / Разовые»,
// «Пример». В кабинете скидки видны (PLAN §3б); карточка сайту не нужна.

export type ProgramsT = ReturnType<typeof useTranslations<"admin.programs">>;
export type Chip = { key: string; value: string; note: string };
export type KvRow = { key: string; label: string; value: string };

export function programTitle(item: ProgramItem, t: ProgramsT): string {
  return item.bankName ? item.bankName.ru : t(`kinds.${item.kind}`);
}

/** Полное имя для диктора и уведомлений: у банка две программы — «Ipoteka Bank · Ипотека». */
export function programFullName(item: ProgramItem, t: ProgramsT): string {
  return item.bankName
    ? `${item.bankName.ru} · ${t(`kinds.${item.kind}`)}`
    : t(`kinds.${item.kind}`);
}

export function programSubtitle(item: ProgramItem, t: ProgramsT): string {
  const method = t(`methods.${item.record.method ?? "full"}`);
  return item.bankName ? `${t(`kinds.${item.kind}`)} · ${method}` : method;
}

export const programMark = (item: ProgramItem, developerName: string) =>
  initialsOf(item.bankName?.ru ?? developerName);

export function termText(months: number, t: ProgramsT): string {
  const { unit, count } = termParts(months);
  return unit === "years" ? t("card.years", { count }) : t("card.months", { count });
}

export function programChips(item: ProgramItem, t: ProgramsT): Chip[] {
  const { program } = item;
  if (program.type === "full") return [];
  if (program.method === "tiers") {
    return program.tiers.map((tier, index) => ({
      key: `tier-${index}`,
      value: t("card.tierChip", { down: formatPercent(tier.minDownPct) }),
      note: t("card.tierChipValue", {
        discount: tier.discountPct > 0 ? formatPercent(tier.discountPct) : "none",
        months: termText(tier.maxMonths, t),
      }),
    }));
  }
  return program.terms.map((row) => ({
    key: `term-${row.months}`,
    value: termText(row.months, t),
    note:
      program.method === "markup"
        ? t("card.termMarkup", { rate: formatPercent(row.ratePct) })
        : t("card.termRate", { rate: formatPercent(row.ratePct) }),
  }));
}

function feesText(item: ProgramItem, t: ProgramsT): string {
  const { program } = item;
  if (program.type === "full" || program.method === "tiers" || program.fees.length === 0) {
    return t("card.none");
  }
  const currency = program.currency ?? "USD";
  return program.fees
    .map(
      (fee) =>
        `${t(`fees.${fee.name}`)} ${fee.kind === "pct" ? formatPercent(fee.value) : formatPrice(fee.value, currency)}`,
    )
    .join(", ");
}

function blocksText(item: ProgramItem, panel: ProgramPanel, t: ProgramsT): string {
  if (item.record.blocks_scope === "all") return t("card.blocksAll");
  const names = item.record.block_ids
    .map((id) => panel.blocks.find((block) => block.id === id))
    .filter((block) => block !== undefined)
    .map((block) => `${block.complexName.ru} ${block.name}`);
  return names.length > 0 ? names.join(", ") : t("card.blocksNone");
}

function rulesText(item: ProgramItem, t: ProgramsT): string | null {
  const { program } = item;
  if (program.type === "full" || program.method !== "tiers") return null;
  const parts = [
    program.presetMonths.length > 0
      ? t("card.buttons", { buttons: program.presetMonths.join(" · ") })
      : t("card.noButtons"),
    program.allowCustomMonths ? t("card.custom") : null,
    t(`card.overMax.${program.overMaxBehavior}`),
  ];
  return parts.filter(Boolean).join(" · ");
}

function downText(item: ProgramItem, t: ProgramsT): string {
  const { program } = item;
  if (program.type === "full") {
    if (program.discountPct === 0) return t("card.downFullPlain");
    return t("card.downFull", { pct: formatPercent(program.discountPct) });
  }
  const min = program.method === "tiers" ? (program.tiers[0]?.minDownPct ?? 0) : program.minDownPct;
  return t("card.downFrom", { pct: formatPercent(min) });
}

/** Валюта: у банка в сумах — по какому курсу (ручной — «по курсу на дд.мм», Р6). */
function currencyText(item: ProgramItem, rate: ExchangeRate | null, t: ProgramsT): string {
  const { program } = item;
  if (program.type === "full" || program.method === "tiers" || program.currency === null) {
    return t("card.currencyPrice");
  }
  if (program.currency === "USD") return t("card.currencyUsd");
  return rate?.source === "manual"
    ? t("card.currencyUzsManual", { date: formatDate(new Date(rate.date)) })
    : t("card.currencyUzs");
}

export function programRows(
  item: ProgramItem,
  panel: ProgramPanel,
  rate: ExchangeRate | null,
  t: ProgramsT,
): KvRow[] {
  const rules = rulesText(item, t);
  const showFees = item.kind !== "full" && item.kind !== "scheme";
  return [
    { key: "down", label: t("card.down"), value: downText(item, t) },
    { key: "currency", label: t("card.currency"), value: currencyText(item, rate, t) },
    { key: "blocks", label: t("card.blocks"), value: blocksText(item, panel, t) },
    ...(showFees ? [{ key: "fees", label: t("card.fees"), value: feesText(item, t) }] : []),
    ...(rules ? [{ key: "rules", label: t("card.rules"), value: rules }] : []),
  ];
}

/** «Пример: 60 м² × $690, взнос 30 %, 36 мес. → $723/мес»; нет цены — null. */
export function exampleText(
  item: ProgramItem,
  panel: ProgramPanel,
  rate: ExchangeRate | null,
  t: ProgramsT,
): string | null {
  if (!panel.priceHint) return null;
  const example = programExample(item.program, panel.priceHint, rate);
  // Нет курса — скажем; недописанный черновик в превью — просто без «Примера».
  if (!example.result.ok)
    return example.result.problem === "noRate" ? t("card.exampleNoRate") : null;
  const calc = example.result.calculation;
  const perM2 = formatPrice(example.perM2, example.priceCurrency);
  if (calc.method === null) {
    const price = formatPrice(example.price, example.priceCurrency);
    if (calc.programPrice === calc.price) {
      return t("card.examplePlain", { area: example.areaM2, perM2, price });
    }
    return t("card.exampleFull", {
      area: example.areaM2,
      perM2,
      price,
      total: formatPrice(calc.total, calc.currency),
    });
  }
  return t("card.exampleMonthly", {
    area: example.areaM2,
    perM2,
    down: formatPercent(calc.downPct),
    term: termText(calc.months, t),
    payment: formatPrice(calc.firstPayment, calc.currency),
    first: String(calc.method === "differentiated"),
  });
}
