import type { ReactNode } from "react";

type CalcStepProps = { id: string; number: number; title: string; children: ReactNode };

/** Шаг калькулятора сайта (мокап SiteCalc, В6 A): карточка с номером «01» и заголовком. */
export function CalcStep({ id, number, title, children }: CalcStepProps) {
  return (
    <section className="calc-step" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="calc-step__title">
        <span className="calc-step__number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
