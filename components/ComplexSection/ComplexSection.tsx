"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/lib/motion";

type ComplexSectionProps = {
  /** Якорь навигатора страницы (ТЗ 7.2): «o-zhk», «planirovki»… */
  id: string;
  title: ReactNode;
  /** Подзаголовок под заголовком (мокап .sec__h p.muted). */
  lead?: ReactNode;
  /** «обновлено 25.10, 14:05» справа от заголовка (мокап .sec__h .live; телефон — .livetag). */
  stamp?: string | null;
  /** Кнопка справа от заголовка (мокап .sec__h: «Запросить сканы документов»). */
  action?: ReactNode;
  /** Первый раздел после навигатора — с меньшим отступом сверху (мокап .sec--tight). */
  tight?: boolean;
  children: ReactNode;
};

/**
 * Раздел страницы ЖК (мокап .sec): заголовок h2 с подзаголовком и правой частью, появление при
 * прокрутке — один хук сайта (useReveal): full — подъём, lite — проявление, none — сразу.
 */
export function ComplexSection({ id, title, lead, stamp, action, tight = false, children }: ComplexSectionProps) {
  const reveal = useReveal<HTMLElement>();
  return (
    <section ref={reveal} id={id} className={tight ? "complex-section complex-section--tight" : "complex-section"} aria-labelledby={`${id}-title`}>
      <div className="complex-section__head">
        <div className="complex-section__heading">
          <h2 id={`${id}-title`} className="complex-section__title">
            {title}
          </h2>
          {lead ? <p className="complex-section__lead">{lead}</p> : null}
        </div>
        {stamp ? (
          <p className="complex-section__stamp">
            <i aria-hidden="true" />
            {stamp}
          </p>
        ) : null}
        {action}
      </div>
      {children}
    </section>
  );
}
