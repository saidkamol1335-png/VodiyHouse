"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type UIEvent } from "react";
import type { SpecialView } from "@/lib/site/showcase/model";
import { SpecialCard } from "./SpecialCard";

/**
 * Спецпредложения на главной (3.16б): на 1440 — сетка 3 в ряд (мокап .spg), на 390 — лента по
 * кадрам с точками (MobSpecials). Точки считаются по прокрутке; на десктопе их нет (CSS).
 */
export function SpecialsGrid({ specials }: { specials: readonly SpecialView[] }) {
  const t = useTranslations("showcase.special");
  const [current, setCurrent] = useState(0);
  const frame = useRef(0);
  // Прокрутка шлёт события чаще кадра — текущий кадр считаем не чаще одного раза за кадр.
  const onScroll = (event: UIEvent<HTMLUListElement>) => {
    const node = event.currentTarget;
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const item = node.firstElementChild;
      const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
      const width = item instanceof HTMLElement ? item.offsetWidth + gap : node.clientWidth;
      setCurrent(Math.min(specials.length - 1, Math.round(node.scrollLeft / Math.max(width, 1))));
    });
  };
  return (
    <div className="specials">
      <ul className="specials__grid" aria-label={t("label")} onScroll={onScroll}>
        {specials.map((view) => (
          <li key={view.special.id} className="specials__item">
            <SpecialCard view={view} />
          </li>
        ))}
      </ul>
      {specials.length > 1 ? (
        <div className="specials__dots" role="img" aria-label={t("slide", { n: current + 1, total: specials.length })}>
          {specials.map((view, index) => (
            <i key={view.special.id} className={index === current ? "specials__dot specials__dot--on" : "specials__dot"} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
