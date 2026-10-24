"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { useId, useState } from "react";
import type { CalcLocale, CalcT } from "@/components/PaymentCalculator/calcText";
import type { Calculation } from "@/lib/calc/calculate";
import type { Currency, ExchangeRate } from "@/lib/calc/money";
import { formatPrice } from "@/lib/format";
import { type ScheduleColumn, scheduleColumns, scheduleIn, scheduleTotals } from "./scheduleRows";

const FIRST_ROWS = 12;

type CalcScheduleProps = {
  calculation: Calculation;
  out: Currency;
  rate: ExchangeRate | null;
  t: CalcT;
  locale: CalcLocale;
};

/**
 * График платежей (В8 B): раскрытие на всю ширину, первые 12 строк и «Показать все N», без
 * прокрутки внутри; строка «Всего». Нет платежей (100 % оплата) — нет и графика.
 */
export function CalcSchedule(props: CalcScheduleProps) {
  const { calculation, t } = props;
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (calculation.method === null || calculation.months === 0) return null;
  return (
    <section className="calc-schedule">
      <button
        type="button"
        className="calc-schedule__toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <Table2 size={18} aria-hidden="true" />
        {open ? t("schedule.hide") : t("schedule.show")}
        <ChevronDown size={16} aria-hidden="true" className="calc-schedule__chevron" />
      </button>
      {open ? <SchedulePanel {...props} id={panelId} /> : null}
    </section>
  );
}

/** Таблица: первые 12 строк, «Показать все N», строка «Всего»; суммы — в валюте итога. */
function SchedulePanel({
  calculation,
  out,
  rate,
  t,
  locale,
  id,
}: CalcScheduleProps & { id: string }) {
  const [all, setAll] = useState(false);
  const { rows, currency } = scheduleIn(calculation, out, rate);
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  const columns = scheduleColumns(calculation);
  const money = (amount: number) => formatPrice(amount, currency, locale);
  return (
    <div id={id} className="calc-schedule__panel">
      <table className="calc-schedule__table">
        <caption className="sr-only">{t("schedule.caption")}</caption>
        <ScheduleHead columns={columns} calculation={calculation} t={t} />
        <tbody>
          {shown.map((row) => (
            <tr key={row.month}>
              <th scope="row">{row.month}</th>
              {columns.map((column) => (
                <td key={column} className={`calc-schedule__cell calc-schedule__cell--${column}`}>
                  {money(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <ScheduleFoot columns={columns} rows={rows} money={money} t={t} />
      </table>
      {!all && rows.length > FIRST_ROWS ? (
        <button type="button" className="calc-schedule__more" onClick={() => setAll(true)}>
          {t("schedule.more", { count: rows.length })}
        </button>
      ) : null}
    </div>
  );
}

type HeadProps = { columns: readonly ScheduleColumn[]; calculation: Calculation; t: CalcT };

function ScheduleHead({ columns, calculation, t }: HeadProps) {
  const label = (column: ScheduleColumn) =>
    column === "interest" && calculation.method === "markup"
      ? t("schedule.markup")
      : t(`schedule.${column}`);
  return (
    <thead>
      <tr>
        <th scope="col">{t("schedule.month")}</th>
        {columns.map((column) => (
          <th
            key={column}
            scope="col"
            className={`calc-schedule__cell calc-schedule__cell--${column}`}
          >
            {label(column)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

type FootProps = {
  columns: readonly ScheduleColumn[];
  rows: Parameters<typeof scheduleTotals>[0];
  money: (amount: number) => string;
  t: CalcT;
};

function ScheduleFoot({ columns, rows, money, t }: FootProps) {
  const totals = scheduleTotals(rows);
  return (
    <tfoot>
      <tr>
        <th scope="row">{t("schedule.total")}</th>
        {columns.map((column) => (
          <td key={column} className={`calc-schedule__cell calc-schedule__cell--${column}`}>
            {column === "balance" ? "" : money(totals[column])}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}
