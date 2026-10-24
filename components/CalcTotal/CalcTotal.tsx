import type { ReactNode } from "react";
import { Beam } from "@/components/Beam";
import type { TotalHead, TotalRow } from "./totalRows";

type CalcTotalProps = {
  /** Моно-строка сверху: «РАССРОЧКА ОТ ЗАСТРОЙЩИКА», «IPOTEKA BANK · ИПОТЕКА». */
  eyebrow: string;
  /** Переключатель $ | сум (В9) — когда есть курс. */
  currency?: ReactNode;
  head: TotalHead | null;
  rows: readonly TotalRow[];
  /** Почему нечего показать: нет стоимости, курса, сроков. */
  problem?: string | null;
  /** Кнопки: «Скопировать для Telegram», «Получить точный расчёт». */
  actions?: ReactNode;
  footnotes: readonly string[];
  /** Луч по рамке (только full) — у итога /kalkulyator (В4 A), не в кабинете. */
  beam?: boolean;
  /** Нейтральная рамка — итог внутри янтарного блока (кабинет, расчёт квартиры; В4 A). */
  plain?: boolean;
};

/**
 * Итог расчёта (В4 A, Р9): на 1440 — светлая карточка с рамкой, на телефоне — тёмная панель
 * мокапа MobFlat. Цифры не анимируем (решение фазы 2).
 */
export function CalcTotal({
  eyebrow,
  currency,
  head,
  rows,
  problem,
  actions,
  footnotes,
  beam = false,
  plain = false,
}: CalcTotalProps) {
  return (
    <section
      className={plain ? "calc-total calc-total--plain" : "calc-total"}
      aria-label={eyebrow}
      data-testid="calc-total"
    >
      {beam ? <Beam /> : null}
      <div className="calc-total__top">
        <p className="calc-total__eyebrow">{eyebrow}</p>
        {currency}
      </div>
      {head ? <HeadBlock head={head} /> : null}
      {problem ? <p className="calc-total__problem">{problem}</p> : null}
      {rows.length > 0 ? <RowList rows={rows} /> : null}
      {actions ? <div className="calc-total__actions">{actions}</div> : null}
      {footnotes.map((text) => (
        <p key={text} className="calc-total__footnote">
          {text}
        </p>
      ))}
    </section>
  );
}

/** Крупная сумма; длинная (сумы, «1 158 636 000 сум») — кеглем поменьше. */
function HeadBlock({ head }: { head: TotalHead }) {
  const long = head.value.length > 11;
  return (
    <div className="calc-total__head">
      <p className="calc-total__label">{head.label}</p>
      <p className={long ? "calc-total__value calc-total__value--long" : "calc-total__value"}>
        {head.value}
      </p>
      {head.approx ? <p className="calc-total__approx">{head.approx}</p> : null}
    </div>
  );
}

function RowList({ rows }: { rows: readonly TotalRow[] }) {
  return (
    <dl className="calc-total__rows">
      {rows.map((row) => (
        <div
          key={row.key}
          className={row.tone ? `calc-total__row calc-total__row--${row.tone}` : "calc-total__row"}
        >
          <dt>
            {row.label}
            {row.note ? <span className="calc-total__note">{row.note}</span> : null}
          </dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
