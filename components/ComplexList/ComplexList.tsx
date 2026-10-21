"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Badge, type BadgeTone } from "@/components/Badge";
import { FilterPills } from "@/components/FilterPills";
import { PublicationBadge } from "@/components/PublicationBadge";
import { SearchField } from "@/components/SearchField";
import {
  complexFilterCounts,
  filterComplexes,
  isHiddenByDeveloper,
  type ComplexListRow,
} from "@/lib/admin/complexes/list";
import { stockTone, type ComplexStock, type StockTone } from "@/lib/admin/complexes/stock";
import { deletionDate } from "@/lib/admin/developers/publication";
import { PUBLICATION_FILTERS, type PublicationFilter } from "@/lib/admin/publicationFilter";
import { formatDate } from "@/lib/format";

type ComplexListProps = {
  rows: readonly ComplexListRow[];
  /** Адрес раздела: /admin/zhk или служебный стенд. */
  baseHref: string;
  /** «ЖК застройщика»: ?zastroyshchik=<id>; крестик ведёт на весь список. */
  developer?: { id: string; name: string } | null;
};

const STOCK_TONES: Record<StockTone, BadgeTone> = { none: "neutral", low: "amber", ok: "ok" };

/** «ЖК» (в. 5): поиск и пилюли статусов сверху, строки как «Остатки по ЖК» мокапа. */
export function ComplexList({ rows, baseHref, developer = null }: ComplexListProps) {
  const t = useTranslations("admin.complexes");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PublicationFilter>("all");
  const developerId = developer?.id ?? null;
  const counts = useMemo(() => complexFilterCounts(rows, developerId), [rows, developerId]);
  const visible = filterComplexes(rows, { query, filter, developerId });
  const pills = PUBLICATION_FILTERS.map((key) => ({
    key,
    label: t(`filters.${key}`),
    count: counts[key],
  }));

  return (
    <section className="complex-list" aria-labelledby="complex-list-title">
      <div className="complex-list__toolbar">
        <SearchField
          id="complex-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
        />
        <FilterPills label={t("filtersLabel")} pills={pills} value={filter} onChange={setFilter} />
      </div>
      <div className="complex-list__panel">
        <header className="complex-list__head">
          <h2 id="complex-list-title" className="complex-list__title">
            {t("listTitle")}
          </h2>
          {developer ? (
            <Link className="complex-list__scope" href={baseHref}>
              {t("developerScope", { name: developer.name })}
              <X size={14} aria-label={t("developerScopeReset")} />
            </Link>
          ) : null}
          <span className="complex-list__count">{t("count", { count: visible.length })}</span>
        </header>
        {visible.length === 0 ? (
          <p className="complex-list__empty">
            {rows.length === 0 ? t("empty") : t("nothingFound")}
          </p>
        ) : (
          <ul className="complex-list__rows">
            {visible.map((row) => (
              <ComplexRow key={row.id} row={row} href={`${baseHref}/${row.id}`} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ComplexRow({ row, href }: { row: ComplexListRow; href: string }) {
  const t = useTranslations("admin.complexes");
  const name = t("namePrefixed", { name: row.name.ru });
  return (
    <li>
      <Link className="complex-list__row" href={href} aria-label={t("open", { name })}>
        <span className="complex-list__main">
          <span className="complex-list__name">{name}</span>
          <span className="complex-list__meta">{metaLine(row, t)}</span>
          {isHiddenByDeveloper(row) ? (
            <span className="complex-list__warning">{t("hiddenByDeveloper")}</span>
          ) : null}
        </span>
        <span className="complex-list__rooms">{roomsLine(row.stock, t)}</span>
        <span className="complex-list__stock">
          <StockBadge stock={row.stock} />
        </span>
        <span className="complex-list__status">
          <PublicationBadge status={row.status} />
        </span>
        <ChevronRight className="complex-list__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

function StockBadge({ stock }: { stock: ComplexStock }) {
  const t = useTranslations("admin.complexes.stock");
  if (stock.groups.length === 0) return <Badge tone="neutral">{t("none")}</Badge>;
  if (stock.free === 0 && stock.partial) {
    return (
      <span title={t("partialHint")}>
        <Badge tone="ok">{t("byLayouts")}</Badge>
      </span>
    );
  }
  const text = stock.partial
    ? t("freePartial", { count: stock.free })
    : t("free", { count: stock.free });
  return (
    <span title={stock.partial ? t("partialHint") : undefined}>
      <Badge tone={STOCK_TONES[stockTone(stock)]}>{text}</Badge>
    </span>
  );
}

type Translate = ReturnType<typeof useTranslations<"admin.complexes">>;

/** «Фергана · Farg‘ona Sifat Qurilish»; у архива — дата окончательного удаления. */
function metaLine(row: ComplexListRow, t: Translate): string {
  const parts = [row.locationName ?? t("noLocation"), row.developerName];
  if (row.status === "archived" && row.archivedAt) {
    parts.push(t("archivedUntil", { date: formatDate(deletionDate(row.archivedAt)) }));
  }
  return parts.join(" · ");
}

/** «Ст 7 · 1к 10 · 4+ 3»; тип без списка квартир — без числа, с галочкой «есть». */
function roomsLine(stock: ComplexStock, t: Translate): string {
  return stock.groups.map((item) => `${t(`rooms.${item.group}`)} ${item.free ?? "✓"}`).join(" · ");
}
