import type { TotalContext } from "@/components/CalcTotal";
import type { CalcLeadRow } from "@/components/CalcLead";
import { telegramText } from "@/components/PaymentCalculator/telegramText";
import { termText } from "@vh/shared/calc/text";
import { formatAmount, formatPercent } from "@vh/shared/format";
import { type RealtorState, parseAmount, parseNumber } from "./realtorState";
import { type RealtorView, money } from "./realtorView";

// Заявка «Получить точный расчёт» и «Скопировать для Telegram» риелторского калькулятора (PLAN §10,
// п. 48) — из строк итога на экране.

/** «64,2 м² × 7 700 000 сум» — откуда стоимость, если считали по площади. */
export function placeOf(state: RealtorState, context: TotalContext): string | null {
  if (state.priceMode !== "area" || state.tab === "afford") return null;
  const area = parseNumber(state.area);
  const perM2 = parseAmount(state.perM2);
  if (area === null || perM2 === null) return null;
  const currency = context.t(state.inCurrency === "USD" ? "currency.usd" : "currency.uzs");
  const perM2Text = state.inCurrency === "USD" ? `$${formatAmount(perM2)}` : `${formatAmount(perM2)} ${currency}`;
  return context.t("telegram.area", { area: formatAmount(area), perM2: perM2Text });
}

/**
 * Строки заявки «Получить точный расчёт» (не больше 8 — предел сервера): что считали, стоимость,
 * взнос, срок, ставка или наценка, платёж, переплата, итог.
 */
export function leadRowsOf(state: RealtorState, view: RealtorView, context: TotalContext): CalcLeadRow[] {
  const { calc, head } = view;
  if (!calc || !head) return [];
  const { t } = context;
  const place = placeOf(state, context);
  const price = money(calc.price, calc, context);
  const rows: CalcLeadRow[] = [
    { label: t("realtor.lead.mode"), value: view.eyebrow },
    { label: t("realtor.lead.price"), value: place ? `${price} · ${place}` : price },
    {
      label: t("realtor.lead.down"),
      value: `${money(calc.down, calc, context)} · ${formatPercent(calc.downPct)}`,
    },
    { label: t("realtor.lead.term"), value: termText(calc.months, t) },
    state.tab === "installment"
      ? { label: t("realtor.lead.markup"), value: formatPercent(calc.ratePct ?? 0) }
      : { label: t("realtor.lead.rate"), value: `${formatPercent(calc.ratePct ?? 0)} · ${t(`realtor.method.${state.method}`)}` },
    // У подбора по платежу крупно — цена (она уже строкой «Стоимость»), а ввод посетителя — платёж.
    state.tab === "afford" ? monthlyRow(view) ?? head : { label: head.label, value: head.value },
  ];
  const overpayment = view.rows.find((row) => row.key === "overpayment");
  if (overpayment) rows.push({ label: overpayment.label, value: overpayment.value });
  const total = view.rows.find((row) => row.key === "total");
  if (total) rows.push({ label: total.label, value: total.value });
  return rows;
}

const monthlyRow = (view: RealtorView) => {
  const row = view.rows.find((item) => item.key === "monthly");
  return row ? { label: row.label, value: row.value } : null;
};

/** Текст «Скопировать для Telegram»: тот же шаблон, что у калькулятора квартиры. */
export function telegramOf(
  state: RealtorState,
  view: RealtorView,
  context: TotalContext,
  link?: string,
): string | null {
  if (!view.calc || !view.head) return null;
  return telegramText(
    {
      title: view.eyebrow,
      place: placeOf(state, context),
      head: view.head,
      rows: view.rows,
      term: termText(view.calc.months, context.t),
      footnotes: view.footnotes,
      ...(link ? { link } : {}),
    },
    context.t,
  );
}
