"use client";

import { useTranslations } from "next-intl";
import { useId, useState, type KeyboardEvent } from "react";
import { CatalogGrid } from "@/components/CatalogGrid";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { developerCounts, isDelivered } from "@/lib/site/developers/model";

type Tab = "all" | "built" | "building";
const TABS: readonly Tab[] = ["all", "built", "building"];

type DeveloperObjectsProps = { catalog: SiteCatalog; complexes: readonly CatalogComplex[] };

/** Стрелки, Home и End ходят по вкладкам (паттерн tablist); чужая клавиша — null. */
function tabByKey(key: string, current: Tab): Tab | null {
  const index = TABS.indexOf(current);
  if (key === "ArrowRight") return TABS[(index + 1) % TABS.length] ?? null;
  if (key === "ArrowLeft") return TABS[(index + TABS.length - 1) % TABS.length] ?? null;
  if (key === "Home") return TABS[0] ?? null;
  if (key === "End") return TABS[TABS.length - 1] ?? null;
  return null;
}

/**
 * «Объекты» застройщика (мокап SiteDev, ТЗ 8.6): вкладки «Все · Сдано · Строится» со счётчиками,
 * карточки каталога. ЖК ровно в одной вкладке: «Все» = «Сдано» + «Строится».
 */
type ObjectTabsProps = { baseId: string; tab: Tab; counts: Record<Tab, number>; onChange: (tab: Tab) => void };

/** Вкладки со счётчиками: в Tab-порядке одна — выбранная, остальные — стрелками (паттерн tablist). */
function ObjectTabs({ baseId, tab, counts, onChange }: ObjectTabsProps) {
  const t = useTranslations("developers.page");
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabByKey(event.key, tab);
    if (!next) return;
    event.preventDefault();
    onChange(next);
    document.getElementById(`${baseId}-tab-${next}`)?.focus();
  };
  return (
    <div className="developer-objects__tabs" role="tablist" aria-label={t("tabs.label")} onKeyDown={onKeyDown}>
      {TABS.map((key) => (
        <button
          key={key}
          id={`${baseId}-tab-${key}`}
          type="button"
          role="tab"
          aria-selected={tab === key}
          tabIndex={tab === key ? 0 : -1}
          aria-controls={`${baseId}-panel`}
          className={tab === key ? "developer-objects__tab developer-objects__tab--on" : "developer-objects__tab"}
          onClick={() => onChange(key)}
        >
          {t(`tabs.${key}`)}
          <span className="developer-objects__count">{counts[key]}</span>
        </button>
      ))}
    </div>
  );
}

export function DeveloperObjects({ catalog, complexes }: DeveloperObjectsProps) {
  const t = useTranslations("developers.page");
  const [tab, setTab] = useState<Tab>("all");
  const baseId = useId();
  const counts = developerCounts(complexes);
  const shown = complexes.filter((complex) => tab === "all" || (tab === "built") === isDelivered(complex));
  return (
    <section className="developer-objects" aria-labelledby={`${baseId}-title`}>
      <div className="developer-objects__head">
        <h2 id={`${baseId}-title`} className="heading heading--h2">
          {t("objects")}
        </h2>
        {complexes.length > 0 ? <ObjectTabs baseId={baseId} tab={tab} counts={counts} onChange={setTab} /> : null}
      </div>
      {complexes.length === 0 ? (
        <p className="developer-objects__empty">{t("noObjects")}</p>
      ) : (
        <div id={`${baseId}-panel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${tab}`} className="developer-objects__panel">
          <CatalogGrid catalog={catalog} complexes={shown} />
        </div>
      )}
    </section>
  );
}
