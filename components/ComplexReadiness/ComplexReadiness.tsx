"use client";

import { Check, ChevronDown, Circle } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { photosShort, REQUIREMENT_TAB, type ReadinessItem } from "@/lib/admin/complexes/readiness";
import { complexTabHref } from "@/lib/admin/complexes/tabs";

type ComplexReadinessProps = {
  items: readonly ReadinessItem[];
  /** Адрес страницы ЖК: пункты ведут на свои вкладки. */
  base: string;
};

/** «Для публикации: 5 из 8 · показать» (И9): у черновика и скрытого ЖК, под капсулой статуса. */
export function ComplexReadiness({ items, base }: ComplexReadinessProps) {
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
              missingPhotos={photosShort(items)}
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
  /** Сколько фото не хватает до публикации — подпись у пункта «Фото». */
  missingPhotos: number;
};

/** Пункт готовности — ссылка на вкладку, где его закрывают. */
function ReadinessRow({ item, base, missingPhotos }: ReadinessRowProps) {
  const t = useTranslations("admin.complexes.readiness");
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
      <Link href={complexTabHref(base, REQUIREMENT_TAB[item.requirement])}>
        {t(`items.${item.requirement}`)}
      </Link>
      {item.requirement === "photos" && !item.ok ? (
        <span className="complex-readiness__note">
          {t("photosShort", { count: missingPhotos })}
        </span>
      ) : null}
    </li>
  );
}
