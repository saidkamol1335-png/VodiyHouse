import type { ReactNode } from "react";
import { Beam } from "@/components/Beam";
import { Hint } from "@/components/Hint";
import { RollingNumber } from "@/components/RollingNumber";
import type { CalcHintSlug } from "@vh/shared/calc/hints";
import type { TotalHead, TotalRow } from "./totalRows";

type CalcTotalProps = {
  /** Моно-строка сверху: «РАССРОЧКА ОТ ЗАСТРОЙЩИКА», «IPOTEKA BANK · ИПОТЕКА». */
  eyebrow: string;
  /** «?» к виду программы в надписи (шаг 2.8). */
  eyebrowHint?: CalcHintSlug;
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
  /**
   * Риелторский /kalkulyator (PLAN §10, п. 49): сумма катится по разрядам, изменившаяся строка
   * коротко подсвечивается; у расчёта квартиры цифры по-прежнему не анимируются (решение фазы 2).
   */
  lively?: boolean;
  /** Под крупной суммой: полоса «из чего выплата» (/kalkulyator). */
  figure?: ReactNode;
};

/**
 * Итог расчёта (В4 A, Р9): на 1440 — светлая карточка с рамкой, на телефоне — тёмная панель
 * мокапа MobFlat. Цифры не анимируем (решение фазы 2) — кроме lively у /kalkulyator (п. 49).
 */
export function CalcTotal({
  eyebrow,
  eyebrowHint,
  currency,
  head,
  rows,
  problem,
  actions,
  footnotes,
  beam = false,
  plain = false,
  lively = false,
  figure,
}: CalcTotalProps) {
  return (
    <section
      className={plain ? "calc-total calc-total--plain" : "calc-total"}
      aria-label={eyebrow}
      data-testid="calc-total"
      // Цель «К расчёту ↓» в липкой полосе: фокус сюда, а не на исчезающую полосу.
      tabIndex={-1}
    >
      {beam ? <Beam /> : null}
      <div className="calc-total__top">
        <p className="calc-total__eyebrow">
          {eyebrow}
          {eyebrowHint ? <Hint slug={eyebrowHint} /> : null}
        </p>
        {currency}
      </div>
      {head ? <HeadBlock head={head} lively={lively} /> : null}
      {problem ? <p className="calc-total__problem">{problem}</p> : null}
      {head ? figure : null}
      {rows.length > 0 ? <RowList rows={rows} lively={lively} /> : null}
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
function HeadBlock({ head, lively }: { head: TotalHead; lively: boolean }) {
  const long = head.value.length > 11;
  return (
    <div className="calc-total__head">
      <p className="calc-total__label">{head.label}</p>
      <p className={long ? "calc-total__value calc-total__value--long" : "calc-total__value"}>
        {lively ? <RollingNumber value={head.value} /> : head.value}
      </p>
      {head.approx ? <p className="calc-total__approx">{head.approx}</p> : null}
    </div>
  );
}

function RowList({ rows, lively }: { rows: readonly TotalRow[]; lively: boolean }) {
  return (
    <dl className="calc-total__rows">
      {rows.map((row) => (
        <div
          key={row.key}
          className={row.tone ? `calc-total__row calc-total__row--${row.tone}` : "calc-total__row"}
        >
          <dt>
            {row.hint ? (
              <span className="calc-total__term">
                {row.label}
                <Hint slug={row.hint} />
              </span>
            ) : (
              row.label
            )}
            {row.note ? <span className="calc-total__note">{row.note}</span> : null}
          </dt>
          {/* Новое значение — новый узел: его вспышка (CalcTotal.css) играет один раз. */}
          <dd>{lively ? <span key={row.value} className="calc-total__flash">{row.value}</span> : row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
