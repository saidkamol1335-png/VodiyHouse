"use client";

import type { CSSProperties } from "react";
import type { TotalContext } from "@/components/CalcTotal";
import type { Calculation } from "@vh/shared/calc/calculate";
import { paymentSchedule } from "@vh/shared/calc/schedule";
import { formatPercent } from "@vh/shared/format";
import { money } from "./realtorView";

// Наглядность расчёта (PLAN §10, п. 49): полоса «из чего выплата» в итоге и остаток долга по
// периодам у графика. Доли и высоты меняются только transform (scaleX / scaleY) — плавно в full.

type Part = { key: "down" | "loan" | "extra"; label: string; amount: number };

/** Взнос · тело кредита (у рассрочки — остаток) · проценты или наценка; нулевые доли не рисуем. */
export function RealtorBreakdown({ calc, context }: { calc: Calculation; context: TotalContext }) {
  const { t } = context;
  const markup = calc.method === "markup";
  const parts: Part[] = [
    { key: "down", label: t("realtor.breakdown.down"), amount: calc.down },
    { key: "loan", label: t(markup ? "realtor.breakdown.rest" : "realtor.breakdown.loan"), amount: calc.financed },
    { key: "extra", label: t(markup ? "realtor.breakdown.markup" : "realtor.breakdown.interest"), amount: calc.extra },
  ];
  const total = parts.reduce((sum, part) => sum + part.amount, 0);
  if (!(total > 0)) return null;
  let start = 0;
  const shown = parts.map((part) => {
    const share = part.amount / total;
    const item = { ...part, share, start };
    start += share;
    return item;
  });
  return (
    <figure className="realtor-calc__breakdown">
      <figcaption className="realtor-calc__breakdown-title">{t("realtor.breakdown.title")}</figcaption>
      <div className="realtor-calc__bar" aria-hidden="true">
        {shown.map((part) => (
          <span
            key={part.key}
            className={`realtor-calc__bar-part realtor-calc__bar-part--${part.key}`}
            style={{ "--part-start": part.start, "--part-share": part.share } as CSSProperties}
          />
        ))}
      </div>
      <ul className="realtor-calc__legend">
        {shown
          .filter((part) => part.amount > 0)
          .map((part) => (
            <li key={part.key} className={`realtor-calc__legend-item realtor-calc__legend-item--${part.key}`}>
              {/* Суммы — строками итога ниже; здесь — доли. */}
              <span className="realtor-calc__legend-label">{part.label}</span>
              <span className="realtor-calc__legend-value">{formatPercent(Math.round(part.share * 100))}</span>
            </li>
          ))}
      </ul>
    </figure>
  );
}

const MAX_BARS = 25;

/**
 * Период столбика: годы — у длинных сроков ровными годами (ипотека); иначе кварталы и месяцы —
 * подпись всегда целая (рассрочка на 40 мес. — не «3,33 года»).
 */
const stepOf = (months: number) =>
  months > 36 && months % 12 === 0 ? 12 : months > MAX_BARS ? 3 : 1;

/** Остаток долга на начало и на конец каждого периода; столбик — доля от суммы кредита. */
export function balanceBars(calc: Calculation): { at: number; balance: number }[] {
  const rows = paymentSchedule(calc);
  if (rows.length < 2) return [];
  const step = stepOf(rows.length);
  const bars = [{ at: 0, balance: calc.financed }];
  for (let month = step; month < rows.length; month += step) bars.push({ at: month, balance: rows[month - 1]!.balance });
  bars.push({ at: rows.length, balance: 0 });
  return bars;
}

/** Мини-график «Остаток долга»: как тает кредит (рассрочка) за срок. */
export function RealtorBalance({ calc, context }: { calc: Calculation; context: TotalContext }) {
  const { t } = context;
  const bars = balanceBars(calc);
  if (bars.length === 0 || !(calc.financed > 0)) return null;
  const inYears = stepOf(calc.months) === 12;
  const unit = t(inYears ? "realtor.term.unitYears" : "realtor.term.unitMonths");
  const label = (at: number) => String(inYears ? at / 12 : at);
  const middle = bars[Math.floor(bars.length / 2)]!;
  const summary = t(inYears ? "realtor.balance.summaryYears" : "realtor.balance.summaryMonths", {
    start: money(calc.financed, calc, context),
    at: inYears ? middle.at / 12 : middle.at,
    middle: money(middle.balance, calc, context),
  });
  // Подписи — через равный шаг и у последнего; соседнюю с последним пропускаем — иначе налезут.
  const every = Math.ceil(bars.length / 6);
  const labeled = (index: number) =>
    index === bars.length - 1 || (index % every === 0 && bars.length - 1 - index >= every / 2);
  return (
    <figure className="realtor-calc__balance">
      <figcaption className="realtor-calc__balance-title">
        {t("realtor.balance.title")}
        <span className="realtor-calc__balance-unit">{t("realtor.balance.axis", { unit })}</span>
      </figcaption>
      <div className="realtor-calc__columns" role="img" aria-label={summary}>
        {bars.map((bar, index) => (
          <span key={bar.at} className="realtor-calc__column">
            <span
              className="realtor-calc__column-fill"
              style={{ "--column-share": bar.balance / calc.financed } as CSSProperties}
            />
            {labeled(index) ? (
              <span className="realtor-calc__column-label">{label(bar.at)}</span>
            ) : null}
          </span>
        ))}
      </div>
    </figure>
  );
}
