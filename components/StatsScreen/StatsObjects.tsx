"use client";

import { useTranslations } from "next-intl";
import { useState, type CSSProperties } from "react";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { conversion, formatStatsCount, formatStatsPercent } from "@/lib/stats/numbers";
import type { SiteStats } from "@/lib/stats/types";

const SHOWN = 7;
type Tab = "complexes" | "developers";
type Row = { id: string; name: string; href: string | null; views: number; leads: number };

/** Мини-полоса конверсии (мокап): 4% и больше — полная. */
const barWidth = (rate: number | null) => `${Math.min(100, (rate ?? 0) * 25)}%`;

/**
 * «Популярные ЖК» (мокап CabStats) и «Застройщики» (PLAN: топ застройщиков) переключателем:
 * просмотры страниц ЖК, заявки, конверсия с мини-полосой; ЖК открывается на сайте.
 */
export function StatsObjects({
  complexes,
  developers,
}: Pick<SiteStats, "complexes" | "developers">) {
  const t = useTranslations("admin.stats.objects");
  const [tab, setTab] = useState<Tab>("complexes");
  const rows: Row[] =
    tab === "complexes"
      ? complexes.map((row) => ({
          ...row,
          name: t("complexName", { name: row.name.ru }),
          href: `/ru/novostroyki/${row.slug}`,
        }))
      : developers.map((row) => ({ ...row, href: null }));
  return (
    <section className="admin-panel stats-objects" aria-labelledby="stats-objects-title">
      <div className="stats-screen__panel-head">
        <h2 id="stats-objects-title" className="admin-panel__title">
          {t("title")}
        </h2>
        <Segmented label={t("title")}>
          {(["complexes", "developers"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={segmentedItemClass(key === tab)}
              aria-pressed={key === tab}
              onClick={() => setTab(key)}
            >
              {t(key)}
            </button>
          ))}
        </Segmented>
      </div>
      {rows.length === 0 ? (
        <p className="stats-screen__empty">{t("empty")}</p>
      ) : (
        <ObjectsTable rows={rows} tab={tab} />
      )}
    </section>
  );
}

/** Таблица: имя (ЖК — ссылкой на сайт), просмотры, заявки, конверсия с мини-полосой; первые 7. */
function ObjectsTable({ rows, tab }: { rows: Row[]; tab: Tab }) {
  const t = useTranslations("admin.stats.objects");
  return (
    <div className="stats-table">
      <table className="stats-table__table">
        <thead>
          <tr>
            <th scope="col">{t(tab === "complexes" ? "complex" : "developer")}</th>
            <th scope="col" className="stats-table__num">
              {t("views")}
            </th>
            <th scope="col" className="stats-table__num">
              {t("leads")}
            </th>
            <th scope="col">{t("conversion")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, SHOWN).map((row) => (
            <ObjectRow key={row.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ObjectRow({ row }: { row: Row }) {
  const rate = conversion(row.leads, row.views);
  return (
    <tr>
      <td>
        {row.href ? (
          <a className="stats-table__link" href={row.href} target="_blank" rel="noopener">
            {row.name}
          </a>
        ) : (
          row.name
        )}
      </td>
      <td className="stats-table__num">{formatStatsCount(row.views)}</td>
      <td className="stats-table__num">{formatStatsCount(row.leads)}</td>
      <td>
        <span className="stats-table__rate">
          <span className="stats-table__minibar" aria-hidden="true">
            <i style={{ "--w": barWidth(rate) } as CSSProperties} />
          </span>
          <span className="stats-table__mono">
            {rate === null ? "—" : `${formatStatsPercent(rate)}%`}
          </span>
        </span>
      </td>
    </tr>
  );
}
