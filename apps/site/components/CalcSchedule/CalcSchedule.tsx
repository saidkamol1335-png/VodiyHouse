"use client";

import { ChevronDown, Table2 } from "lucide-react";
import { useId, useState } from "react";
import type { CalcLocale, CalcT } from "@vh/shared/calc/text";
import type { Calculation } from "@vh/shared/calc/calculate";
import type { Currency, ExchangeRate } from "@vh/shared/calc/money";
import { formatDate, formatPrice } from "@vh/shared/format";
import { paymentDate } from "@vh/shared/calc/realtor";
import { type ScheduleRow, scheduleIn, scheduleTotals } from "@vh/shared/calc/schedule";
import { type ScheduleColumn, scheduleColumns } from "./scheduleRows";

const FIRST_ROWS = 12;

type CalcScheduleProps = {
  calculation: Calculation;
  out: Currency;
  rate: ExchangeRate | null;
  t: CalcT;
  locale: CalcLocale;
  /** «2026-12» — месяц первого платежа: колонка «Дата» (риелторский калькулятор, п. 48). */
  firstMonth?: string;
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
  firstMonth,
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
        <ScheduleHead columns={columns} calculation={calculation} t={t} dated={!!firstMonth} />
        <tbody>
          {shown.map((row) => (
            <ScheduleLine key={row.month} row={row} columns={columns} money={money} firstMonth={firstMonth} />
          ))}
        </tbody>
        <ScheduleFoot columns={columns} rows={rows} money={money} t={t} dated={!!firstMonth} />
      </table>
      {rows.length > FIRST_ROWS ? (
        // Одна кнопка на месте: «Показать все N» ↔ «Свернуть» — фокус не теряется.
        <button
          type="button"
          className="calc-schedule__more"
          aria-expanded={all}
          onClick={() => setAll(!all)}
        >
          {all ? t("schedule.less") : t("schedule.more", { count: rows.length })}
        </button>
      ) : null}
    </div>
  );
}

type LineProps = {
  row: ScheduleRow;
  columns: readonly ScheduleColumn[];
  money: (amount: number) => string;
  firstMonth?: string;
};

/** Строка месяца: номер, дата (если известен первый месяц), суммы колонок. */
function ScheduleLine({ row, columns, money, firstMonth }: LineProps) {
  return (
    <tr>
      <th scope="row">{row.month}</th>
      {firstMonth ? (
        <td className="calc-schedule__cell calc-schedule__cell--date">
          {formatDate(paymentDate(firstMonth, row.month))}
        </td>
      ) : null}
      {columns.map((column) => (
        <td key={column} className={`calc-schedule__cell calc-schedule__cell--${column}`}>
          {money(row[column])}
        </td>
      ))}
    </tr>
  );
}

type HeadProps = {
  columns: readonly ScheduleColumn[];
  calculation: Calculation;
  t: CalcT;
  dated: boolean;
};

function ScheduleHead({ columns, calculation, t, dated }: HeadProps) {
  const label = (column: ScheduleColumn) =>
    column === "interest" && calculation.method === "markup"
      ? t("schedule.markup")
      : t(`schedule.${column}`);
  return (
    <thead>
      <tr>
        <th scope="col">{dated ? "№" : t("schedule.month")}</th>
        {dated ? (
          <th scope="col" className="calc-schedule__cell calc-schedule__cell--date">
            {t("schedule.date")}
          </th>
        ) : null}
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
  dated: boolean;
};

function ScheduleFoot({ columns, rows, money, t, dated }: FootProps) {
  const totals = scheduleTotals(rows);
  return (
    <tfoot>
      <tr>
        <th scope="row">{t("schedule.total")}</th>
        {dated ? <td className="calc-schedule__cell calc-schedule__cell--date" /> : null}
        {columns.map((column) => (
          <td key={column} className={`calc-schedule__cell calc-schedule__cell--${column}`}>
            {column === "balance" ? "" : money(totals[column])}
          </td>
        ))}
      </tr>
    </tfoot>
  );
}
