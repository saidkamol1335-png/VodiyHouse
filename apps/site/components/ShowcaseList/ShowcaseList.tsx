"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { FilterPills } from "@/components/FilterPills";
import { NEW_SHOWCASE_ID, showcaseItemHref } from "@/lib/admin/nav";
import { filterShowcaseRows, showcaseCounts } from "@/lib/admin/showcase/list";
import {
  SHOWCASE_LIST_FILTERS,
  type ShowcaseKind,
  type ShowcaseListFilter,
  type ShowcaseListRow,
} from "@/lib/admin/showcase/types";
import { ShowcaseRow } from "./ShowcaseRow";

export type ShowcaseListItem = ShowcaseListRow & { coverSrc: string | null };

type ShowcaseListProps = {
  kind: ShowcaseKind;
  rows: readonly ShowcaseListItem[];
  /** Адрес раздела: /admin/vitrina или служебный стенд. */
  base: string;
  /** Сегодня по Ташкенту — статус периода считается от него. */
  today: string;
};

/** Вкладка «Витрины» (3.16а): пояснение, пилюли «На сайте / Все», «+ Добавить», строки как у застройщиков. */
export function ShowcaseList({ kind, rows, base, today }: ShowcaseListProps) {
  const t = useTranslations("admin.showcase.list");
  const tLead = useTranslations("admin.showcase.lead");
  const [filter, setFilter] = useState<ShowcaseListFilter>("all");
  const counts = showcaseCounts(rows, today);
  const visible = filterShowcaseRows(rows, filter, today);
  const pills = SHOWCASE_LIST_FILTERS.map((key) => ({
    key,
    label: t(`filters.${key}`),
    count: counts[key],
  }));
  return (
    <section className="showcase-list" aria-labelledby={`showcase-list-${kind}`}>
      <p className="showcase-list__lead">{tLead(kind)}</p>
      <div className="showcase-list__toolbar">
        <FilterPills label={t("filtersLabel")} pills={pills} value={filter} onChange={setFilter} />
        <Button size="sm" href={showcaseItemHref(kind, NEW_SHOWCASE_ID, base)} className="showcase-list__add">
          <Plus size={16} strokeWidth={2} aria-hidden />
          {t(`add.${kind}`)}
        </Button>
      </div>
      <div className="showcase-list__panel">
        <header className="showcase-list__head">
          <h2 id={`showcase-list-${kind}`} className="showcase-list__title">
            {t(`title.${kind}`)}
          </h2>
          <span className="showcase-list__count">{t("count", { count: visible.length })}</span>
        </header>
        {visible.length === 0 ? (
          <p className="showcase-list__empty">{rows.length === 0 ? t(`empty.${kind}`) : t("nothingActive")}</p>
        ) : (
          <ul className="showcase-list__rows">
            {visible.map((row) => (
              <ShowcaseRow key={row.id} row={row} rows={rows} href={showcaseItemHref(kind, row.id, base)} today={today} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
