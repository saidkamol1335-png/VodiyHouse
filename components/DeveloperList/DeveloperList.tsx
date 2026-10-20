"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FilterPills } from "@/components/FilterPills";
import { PublicationBadge } from "@/components/PublicationBadge";
import { SearchField } from "@/components/SearchField";
import {
  DEVELOPER_FILTERS,
  filterCounts,
  filterDevelopers,
  type DeveloperFilter,
  type DeveloperListRow,
} from "@/lib/admin/developers/list";
import { deletionDate } from "@/lib/admin/developers/publication";
import { formatDate, initialsOf } from "@/lib/format";

export type DeveloperListItem = DeveloperListRow & { logoSrc: string | null };

type DeveloperListProps = {
  rows: readonly DeveloperListItem[];
  /** Адрес раздела: /admin/zastroyshchiki или служебный стенд. */
  baseHref: string;
};

const FLATS = new Intl.NumberFormat("ru-RU");

/** «Застройщики» (Д1): поиск и пилюли статусов сверху, строки как панели «Программ оплаты». */
export function DeveloperList({ rows, baseHref }: DeveloperListProps) {
  const t = useTranslations("admin.developers");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DeveloperFilter>("all");
  const counts = useMemo(() => filterCounts(rows), [rows]);
  const visible = filterDevelopers(rows, { query, filter }) as DeveloperListItem[];
  const pills = DEVELOPER_FILTERS.map((key) => ({
    key,
    label: t(`filters.${key}`),
    count: counts[key],
  }));

  return (
    <section className="developer-list" aria-labelledby="developer-list-title">
      <div className="developer-list__toolbar">
        <SearchField
          id="developer-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
        />
        <FilterPills label={t("filtersLabel")} pills={pills} value={filter} onChange={setFilter} />
      </div>
      <div className="developer-list__panel">
        <header className="developer-list__head">
          <h2 id="developer-list-title" className="developer-list__title">
            {t("title")}
          </h2>
          <span className="developer-list__count">{t("count", { count: visible.length })}</span>
        </header>
        {visible.length === 0 ? (
          <p className="developer-list__empty">
            {rows.length === 0 ? t("empty") : t("nothingFound")}
          </p>
        ) : (
          <ul className="developer-list__rows">
            {visible.map((row) => (
              <DeveloperRow key={row.id} row={row} href={`${baseHref}/${row.id}`} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DeveloperRow({ row, href }: { row: DeveloperListItem; href: string }) {
  const t = useTranslations("admin.developers");
  return (
    <li>
      <Link className="developer-list__row" href={href} aria-label={t("open", { name: row.name })}>
        <DeveloperMark name={row.name} src={row.logoSrc} />
        <span className="developer-list__main">
          <span className="developer-list__name">{row.name}</span>
          <span className="developer-list__meta">{metaLine(row, t)}</span>
        </span>
        <span className="developer-list__status">
          <PublicationBadge status={row.status} />
        </span>
        <ChevronRight className="developer-list__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** Логотип или знак-инициалы, как у застройщиков в «Программах оплаты» мокапа. */
function DeveloperMark({ name, src }: { name: string; src: string | null }) {
  if (!src) {
    return (
      <span className="developer-list__mark" aria-hidden="true">
        {initialsOf(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- значок 40 px из бакета; next/image и CDN — на сайте (фаза 3)
    <img className="developer-list__logo" src={src} alt="" width={40} height={40} loading="lazy" />
  );
}

type Translate = ReturnType<typeof useTranslations<"admin.developers">>;

/** «1 ЖК · сдано 2 140 кв. · проверено 14.09.2026»; у архива — дата окончательного удаления. */
function metaLine(row: DeveloperListRow, t: Translate): string {
  const parts = [t("complexes", { count: row.complexes })];
  if (row.flatsDelivered !== null)
    parts.push(t("delivered", { count: FLATS.format(row.flatsDelivered) }));
  if (row.status === "archived" && row.archivedAt) {
    parts.push(t("archivedUntil", { date: formatDate(deletionDate(row.archivedAt)) }));
  } else {
    parts.push(
      row.deliveredCheckedAt
        ? t("checked", { date: formatDate(new Date(row.deliveredCheckedAt)) })
        : t("notChecked"),
    );
  }
  return parts.join(" · ");
}
