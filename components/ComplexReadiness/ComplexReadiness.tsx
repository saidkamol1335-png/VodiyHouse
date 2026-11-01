"use client";

import { Check, ChevronDown, Circle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { rendersShort, REQUIREMENT_TAB, type ReadinessItem } from "@/lib/admin/complexes/readiness";
import type { ComplexCompleteness } from "@/lib/admin/complexes/completeness";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";

type ComplexReadinessProps = {
  items: readonly ReadinessItem[];
  /** Адрес страницы ЖК: пункты ведут на свои вкладки. */
  base: string;
  /** Страница застройщика: пункт «застройщик» ведёт к его публикации. */
  developerHref?: string | null;
  completeness?: ComplexCompleteness | null;
};

/** «Для публикации: 5 из 6 · показать» (И9): у черновика и скрытого ЖК, под капсулой статуса. */
export function ComplexReadiness({ items, base, developerHref = null, completeness = null }: ComplexReadinessProps) {
  const t = useTranslations("admin.complexes.readiness");
  const [open, setOpen] = useState(false);
  const done = items.filter((item) => item.ok).length;
  const ready = done === items.length;
  return (
    <div className={ready ? "complex-readiness complex-readiness--ready" : "complex-readiness"}>
      <button
        type="button"
        className="complex-readiness__toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {ready ? t("ready") : t("summary", { done, total: items.length })}
        <span className="complex-readiness__more">{open ? t("hide") : t("show")}</span>
        <ChevronDown className="complex-readiness__chevron" size={14} aria-hidden="true" />
      </button>
      {open ? (
        <ul className="complex-readiness__list">
          {items.map((item) => (
            <ReadinessRow
              key={item.requirement}
              item={item}
              base={base}
              developerHref={developerHref}
              completeness={completeness}
              missingRenders={rendersShort(items)}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type ReadinessRowProps = {
  item: ReadinessItem;
  base: string;
  developerHref: string | null;
  completeness: ComplexCompleteness | null;
  /** Сколько рендеров не хватает до публикации — подпись у пункта «Фото». */
  missingRenders: number;
};

/** Пункт готовности — ссылка на вкладку, где его закрывают. */
function ReadinessRow({ item, base, developerHref, completeness, missingRenders }: ReadinessRowProps) {
  const t = useTranslations("admin.complexes.readiness");
  // Программа и курс ведутся в «Программах оплаты», застройщик публикуется на своей странице.
  const href =
    item.requirement === "payment"
      ? ADMIN_ROUTES.programs
      : item.requirement === "developer" && developerHref
        ? developerHref
        : complexTabHref(base, REQUIREMENT_TAB[item.requirement]);
  const notes = item.ok || !completeness ? [] : [
    ...(item.requirement === "renders" && !completeness.coverOk ? [t("coverNote")] : []),
    ...(item.requirement === "payment" && !completeness.programOk ? [t("programNote")] : []),
    ...(item.requirement === "payment" && !completeness.rateOk ? [t("rateNote")] : []),
  ];
  return (
    <li
      className={
        item.ok ? "complex-readiness__item complex-readiness__item--ok" : "complex-readiness__item"
      }
    >
      {item.ok ? (
        <Check size={14} aria-label={t("done")} />
      ) : (
        <Circle size={12} aria-label={t("todo")} />
      )}
      <Link href={href}>{t(`items.${item.requirement}`)}</Link>
      {item.requirement === "renders" && !item.ok && missingRenders > 0 ? (
        <span className="complex-readiness__note">
          {t("rendersShort", { count: missingRenders })}
        </span>
      ) : null}
      {notes.map((note) => (
        <span key={note} className="complex-readiness__note">
          {note}
        </span>
      ))}
    </li>
  );
}
