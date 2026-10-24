import type { ReactNode } from "react";

export type CalcCompareRow = {
  id: string;
  name: string;
  /** «50%» */
  down: string;
  /** «18 мес.», «15 лет»; у 100 % — «—» */
  term: string;
  /** «$1 511/мес» или «К оплате сразу» */
  payment: string;
  total: string;
  /** «итого $47 640» — на телефоне под платежом */
  totalShort: string;
  overpayment: string;
  cheapest: boolean;
  lowest: boolean;
  selected: boolean;
};

export type CalcCompareTexts = {
  program: string;
  down: string;
  term: string;
  payment: string;
  total: string;
  overpayment: string;
  cheapest: string;
  lowest: string;
};

type CalcCompareProps = {
  title: string;
  rows: readonly CalcCompareRow[];
  texts: CalcCompareTexts;
  /** «Не посчитать без курса: …» */
  note: string | null;
  onSelect: (id: string) => void;
};

/**
 * Все программы для этой стоимости (мокап r1 — таблица, MobFlatCmp — карточки): метки «выгоднее
 * всего» (у всех с наименьшим итогом) и «меньше платёж»; название в строке выбирает программу.
 */
export function CalcCompare({ title, rows, texts, note, onSelect }: CalcCompareProps) {
  if (rows.length < 2) return null;
  const headers = [texts.down, texts.term, texts.payment, texts.total, texts.overpayment];
  return (
    <section className="calc-compare">
      <h3 className="calc-compare__title">{title}</h3>
      <table className="calc-compare__table">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col">{texts.program}</th>
            {headers.map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <CompareRow key={row.id} row={row} texts={texts} onSelect={onSelect} />
          ))}
        </tbody>
      </table>
      {note ? <p className="calc-compare__note">{note}</p> : null}
    </section>
  );
}

function Label({ tone, children }: { tone: "ok" | "amber"; children: ReactNode }) {
  return <span className={`calc-compare__label calc-compare__label--${tone}`}>{children}</span>;
}

type CompareRowProps = {
  row: CalcCompareRow;
  texts: CalcCompareTexts;
  onSelect: (id: string) => void;
};

function CompareRow({ row, texts, onSelect }: CompareRowProps) {
  return (
    <tr
      className={
        row.selected ? "calc-compare__row calc-compare__row--selected" : "calc-compare__row"
      }
    >
      <th scope="row" className="calc-compare__name">
        <button
          type="button"
          className="calc-compare__pick"
          aria-pressed={row.selected}
          onClick={() => onSelect(row.id)}
        >
          {row.name}
        </button>
        <span className="calc-compare__brief" aria-hidden="true">
          {row.down} · {row.term}
        </span>
      </th>
      <td className="calc-compare__down">{row.down}</td>
      <td className="calc-compare__term">{row.term}</td>
      <td className="calc-compare__payment">
        {row.payment}
        {row.lowest ? <Label tone="ok">{texts.lowest}</Label> : null}
      </td>
      <td className="calc-compare__total">
        <span className="calc-compare__total-value">{row.total}</span>
        {row.cheapest ? <Label tone="amber">{texts.cheapest}</Label> : null}
        <span className="calc-compare__total-short" aria-hidden="true">
          {row.totalShort}
        </span>
      </td>
      <td className="calc-compare__overpayment">{row.overpayment}</td>
    </tr>
  );
}
