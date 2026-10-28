"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { CatalogGrid } from "@/components/CatalogGrid";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { developerCounts, isDelivered } from "@/lib/site/developers/model";

type Tab = "all" | "built" | "building";
const TABS: readonly Tab[] = ["all", "built", "building"];

type DeveloperObjectsProps = { catalog: SiteCatalog; complexes: readonly CatalogComplex[] };

/**
 * «Объекты» застройщика (мокап SiteDev, ТЗ 8.6): вкладки «Все · Сдано · Строится» со счётчиками,
 * карточки каталога. ЖК ровно в одной вкладке: «Все» = «Сдано» + «Строится».
 */
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
        {complexes.length > 0 ? (
          <div className="developer-objects__tabs" role="tablist" aria-label={t("tabs.label")}>
            {TABS.map((key) => (
              <button
                key={key}
                id={`${baseId}-tab-${key}`}
                type="button"
                role="tab"
                aria-selected={tab === key}
                aria-controls={`${baseId}-panel`}
                className={tab === key ? "developer-objects__tab developer-objects__tab--on" : "developer-objects__tab"}
                onClick={() => setTab(key)}
              >
                {t(`tabs.${key}`)}
                <span className="developer-objects__count">{counts[key]}</span>
              </button>
            ))}
          </div>
        ) : null}
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
