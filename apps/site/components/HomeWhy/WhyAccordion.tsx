import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

type WhyRow = { key: string; title: string; tile: ReactNode };

/**
 * Строки «Почему через Vodiy House?» (правки 15.11, п. 6): номер, пункт одной строкой и стрелка; по
 * нажатию — карточка с подробностями. Нативные details/summary: работает без JS, с клавиатуры и у
 * диктора. Текст строки — заголовок h3 раздела; заголовок и подпись внутри карточки повторяют его —
 * их прячет CSS аккордеона.
 */
export function WhyAccordion({ rows }: { rows: WhyRow[] }) {
  return (
    <ul className="home-why__grid home-why__list">
      {rows.map((row, index) => (
        <li key={row.key} className="home-why__item">
          <details className="home-why__row">
            <summary className="home-why__summary">
              <span className="home-why__num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="home-why__question">{row.title}</h3>
              <ChevronDown className="home-why__chevron" size={22} strokeWidth={1.8} aria-hidden />
            </summary>
            <div className="home-why__panel">{row.tile}</div>
          </details>
        </li>
      ))}
    </ul>
  );
}
