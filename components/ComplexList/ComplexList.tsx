"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { FilterPills } from "@/components/FilterPills";
import { PublicationBadge } from "@/components/PublicationBadge";
import { SearchField } from "@/components/SearchField";
import { StockBadge } from "@/components/StockBadge";
import { StockRooms } from "@/components/StockRooms";
import {
  complexFilterCounts,
  filterComplexes,
  isHiddenByDeveloper,
  type ComplexListRow,
} from "@/lib/admin/complexes/list";
import { complexTabHref, type ComplexAccess } from "@/lib/admin/complexes/tabs";
import { deletionDate } from "@/lib/admin/developers/publication";
import { PUBLICATION_FILTERS, type PublicationFilter } from "@/lib/admin/publicationFilter";
import { formatDate } from "@/lib/format";

type ComplexListProps = {
  rows: readonly ComplexListRow[];
  /** Адрес раздела: /admin/zhk или служебный стенд. */
  baseHref: string;
  /** «ЖК застройщика»: ?zastroyshchik=<id>; крестик ведёт на весь список. */
  developer?: { id: string; name: string } | null;
  /** У застройщика в архиве его ЖК — тоже в архиве: список открывается на «Архиве». */
  initialFilter?: PublicationFilter;
  /** Без manage (менеджер, Н2) — без пилюль и плашек публикации, архива нет, строка — сразу tabs[0]. */
  access: ComplexAccess;
};

/** «ЖК» (в. 5): поиск и пилюли статусов сверху, строки как «Остатки по ЖК» мокапа. */
export function ComplexList({
  rows,
  baseHref,
  developer = null,
  initialFilter = "all",
  access,
}: ComplexListProps) {
  const t = useTranslations("admin.complexes");
  const [query, setQuery] = useState("");
  const [pickedFilter, setPickedFilter] = useState<PublicationFilter>(initialFilter);
  // Менеджеру архив не нужен вовсе (М1): «пусто» и «ничего не нашлось» — без него.
  const scoped = access.manage ? rows : rows.filter((row) => row.status !== "archived");
  const filter = access.manage ? pickedFilter : "all";
  const developerId = developer?.id ?? null;
  const visible = filterComplexes(scoped, { query, filter, developerId });
  return (
    <section
      className={access.manage ? "complex-list" : "complex-list complex-list--stock"}
      aria-labelledby="complex-list-title"
    >
      <div className="complex-list__toolbar">
        <SearchField
          id="complex-search"
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={setQuery}
        />
        {access.manage ? (
          <PublicationPills
            rows={rows}
            developerId={developerId}
            value={filter}
            onChange={setPickedFilter}
          />
        ) : null}
      </div>
      <div className="complex-list__panel">
        <ListHead baseHref={baseHref} developer={developer} count={visible.length} />
        <ListRows
          visible={visible}
          emptyText={emptyText(t, access.manage, scoped.length === 0)}
          baseHref={baseHref}
          access={access}
        />
        <PartialFootnote visible={visible} />
      </div>
    </section>
  );
}

/** Что значат «N+» и «по планировкам» — видимым текстом: title на телефоне не открыть. */
function PartialFootnote({ visible }: { visible: readonly ComplexListRow[] }) {
  const t = useTranslations("admin.complexes.stock");
  if (!visible.some((row) => row.stock.partial)) return null;
  return <p className="complex-list__footnote">{t("partialHint")}</p>;
}

type Translate = ReturnType<typeof useTranslations<"admin.complexes">>;

function emptyText(t: Translate, manage: boolean, noRows: boolean): string {
  if (noRows) return t(manage ? "empty" : "emptyStock");
  return t(manage ? "nothingFound" : "nothingFoundStock");
}

type ListHeadProps = {
  baseHref: string;
  developer: { id: string; name: string } | null;
  count: number;
};

function ListHead({ baseHref, developer, count }: ListHeadProps) {
  const t = useTranslations("admin.complexes");
  return (
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
      <span className="complex-list__count">{t("count", { count })}</span>
    </header>
  );
}

type ListRowsProps = {
  visible: readonly ComplexListRow[];
  emptyText: string;
  baseHref: string;
  access: ComplexAccess;
};

function ListRows({ visible, emptyText, baseHref, access }: ListRowsProps) {
  if (visible.length === 0) return <p className="complex-list__empty">{emptyText}</p>;
  const entryTab = access.tabs[0] ?? "main";
  return (
    <ul className="complex-list__rows">
      {visible.map((row) => (
        <ComplexRow
          key={row.id}
          row={row}
          href={complexTabHref(`${baseHref}/${row.id}`, entryTab)}
          publication={access.manage}
        />
      ))}
    </ul>
  );
}

type PublicationPillsProps = {
  rows: readonly ComplexListRow[];
  developerId: string | null;
  value: PublicationFilter;
  onChange: (filter: PublicationFilter) => void;
};

function PublicationPills({ rows, developerId, value, onChange }: PublicationPillsProps) {
  const t = useTranslations("admin.complexes");
  const counts = useMemo(() => complexFilterCounts(rows, developerId), [rows, developerId]);
  const pills = PUBLICATION_FILTERS.map((key) => ({
    key,
    label: t(`filters.${key}`),
    count: counts[key],
  }));
  return <FilterPills label={t("filtersLabel")} pills={pills} value={value} onChange={onChange} />;
}

type ComplexRowProps = { row: ComplexListRow; href: string; publication: boolean };

function ComplexRow({ row, href, publication }: ComplexRowProps) {
  const t = useTranslations("admin.complexes");
  const name = t("namePrefixed", { name: row.name.ru });
  return (
    <li>
      {/* Имя ссылки — всё содержимое строки: диктор слышит остатки, статус и «скрыт застройщиком». */}
      <Link className="complex-list__row" href={href}>
        <span className="complex-list__main">
          <span className="complex-list__name">{name}</span>
          <span className="complex-list__meta">{metaLine(row, t)}</span>
          {publication && isHiddenByDeveloper(row) ? (
            <span className="complex-list__warning">{t("hiddenByDeveloper")}</span>
          ) : null}
        </span>
        <StockRooms stock={row.stock} className="complex-list__rooms" />
        <span className="complex-list__stock">
          <StockBadge stock={row.stock} unassigned={row.unassigned} />
        </span>
        {publication ? (
          <span className="complex-list__status">
            <PublicationBadge status={row.status} />
          </span>
        ) : null}
        <ChevronRight className="complex-list__chevron" size={18} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** «Фергана · Farg‘ona Sifat Qurilish»; у архива — дата окончательного удаления. */
function metaLine(row: ComplexListRow, t: Translate): string {
  const parts = [row.locationName ?? t("noLocation"), row.developerName];
  if (row.status === "archived" && row.archivedAt) {
    parts.push(t("archivedUntil", { date: formatDate(deletionDate(row.archivedAt)) }));
  }
  return parts.join(" · ");
}
