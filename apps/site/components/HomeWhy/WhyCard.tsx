"use client";

import type { CSSProperties, ReactNode } from "react";
import { useSpotlight } from "@/components/Spotlight";
import { useReveal } from "@/lib/motion";

type WhyCardProps = {
  className: string;
  /** Задержка входа карточки в ряду, мс (вариант А: вторая в ряду — +120 мс). */
  delay?: number;
  children: ReactNode;
};

/**
 * Карточка «Почему через Vodiy House»: подсветка за курсором и своя метка появления — по ней CSS
 * запускает въезд карточки и её сюжет (видоискатель, одометр, «0%», сканер, маршрут).
 */
export function WhyCard({ className, delay = 0, children }: WhyCardProps) {
  const reveal = useReveal<HTMLElement>("0px 0px -12% 0px");
  const spot = useSpotlight();
  return (
    <article
      ref={reveal}
      className={`spotlight home-why__tile ${className}`}
      style={{ "--card-delay": `${delay}ms` } as CSSProperties}
      onPointerMove={spot}
    >
      {children}
    </article>
  );
}
