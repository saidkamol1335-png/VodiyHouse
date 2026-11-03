"use client";

import { ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState, type ReactNode } from "react";
import { ComplexStateBadge, PendingRequestBadge } from "@/components/ComplexStateBadge";
import { FilterPills } from "@/components/FilterPills";
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
import type { PublicationFilter } from "@/lib/admin/publicationFilter";
import { formatDate } from "@vh/shared/format";
import { ComplexRowActions, type RowActions } from "./ComplexRowActions";

type ComplexListProps = {
  rows: readonly ComplexListRow[];
  /** Адрес раздела: /zhk или служебный стенд. */
  baseHref: string;
  /** «ЖК застройщика»: ?zastroyshchik=<id>; крестик ведёт на весь список. */
  developer?: { id: string; name: string } | null;
  /** У застройщика в архиве его ЖК — тоже в архиве: список открывается на «Архиве». */
  initialFilter?: PublicationFilter;
  access: ComplexAccess;
  /** ЖК с открытым запросом менеджера — значок «Ожидает руководителя» (п. 25). */
  pending?: ReadonlySet<string>;
  /** Действия в строке — руководителю (пп. 23–24); null — без кнопок. */
  actions?: RowActions | null;
};

/** Вкладки экрана 2 (PLAN §10, п. 23): «На сайте» — и «Скоро», и полные; архив — руководителю. */
const FILTERS: readonly PublicationFilter[] = ["all", "published", "hidden", "draft", "archived"];
const NO_PENDING: ReadonlySet<string> = new Set();

/** Список ЖК (экран 2): вкладки и поиск сверху, строки с остатками, значками и действиями. */
export function ComplexList({
  rows,
  baseHref,
  developer = null,
  initialFilter = "all",
  access,
  pending = NO_PENDING,
  actions = null,
}: ComplexListProps) {
  const developerId = developer?.id ?? null;
  const list = useListFilter(rows, access, developerId, initialFilter);
  return (
    <section
      className={access.manage ? "complex-list" : "complex-list complex-list--stock"}
      aria-labelledby="complex-list-title"
    >
      <ListToolbar query={list.query} onQueryChange={list.setQuery}>
        {access.manage ? (
          <PublicationPills
            rows={list.scoped}
            developerId={developerId}
            filters={access.publish ? FILTERS : FILTERS.filter((key) => key !== "archived")}
            value={list.filter}
            onChange={list.setPickedFilter}
          />
        ) : null}
      </ListToolbar>
      <div className="complex-list__panel">
        <ListHead baseHref={baseHref} developer={developer} count={list.visible.length} />
        <ListRows
          visible={list.visible}
          noRows={list.noRows}
          baseHref={baseHref}
          access={access}
          pending={pending}
          actions={access.publish ? actions : null}
        />
        <PartialFootnote visible={list.visible} />
      </div>
    </section>
  );
}

/** Поиск и вкладки. Архив — корзина руководителя (М1): менеджеру его нет ни в строках, ни во вкладках. */
function useListFilter(
  rows: readonly ComplexListRow[],
  access: ComplexAccess,
  developerId: string | null,
  initialFilter: PublicationFilter,
) {
  const [query, setQuery] = useState("");
  const [pickedFilter, setPickedFilter] = useState<PublicationFilter>(initialFilter);
  const scoped = access.publish ? rows : rows.filter((row) => row.status !== "archived");
  const filter = access.manage ? pickedFilter : "all";
  const visible = filterComplexes(scoped, { query, filter, developerId });
  return { query, setQuery, filter, setPickedFilter, scoped, visible, noRows: scoped.length === 0 };
}

type ListToolbarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  children: ReactNode;
};

function ListToolbar({ query, onQueryChange, children }: ListToolbarProps) {
  const t = useTranslations("admin.complexes");
  return (
    <div className="complex-list__toolbar">
      <SearchField
        id="complex-search"
        label={t("searchLabel")}
        placeholder={t("searchPlaceholder")}
        value={query}
        onChange={onQueryChange}
      />
      {children}
    </div>
  );
}

/** Что значат «N+» и «по планировкам» — видимым текстом: title на телефоне не открыть. */
function PartialFootnote({ visible }: { visible: readonly ComplexListRow[] }) {
  const t = useTranslations("admin.complexes.stock");
  if (!visible.some((row) => row.stock.partial)) return null;
  return <p className="complex-list__footnote">{t("partialHint")}</p>;
}

type Translate = ReturnType<typeof useTranslations<"admin.complexes">>;

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
  /** Строк нет вовсе (а не «ничего не нашлось» по поиску). */
  noRows: boolean;
  baseHref: string;
  access: ComplexAccess;
  pending: ReadonlySet<string>;
  actions: RowActions | null;
};

function ListRows({ visible, noRows, baseHref, access, pending, actions }: ListRowsProps) {
  const t = useTranslations("admin.complexes");
  if (visible.length === 0) {
    return <p className="complex-list__empty">{t(noRows ? "empty" : "nothingFound")}</p>;
  }
  const entryTab = access.tabs[0] ?? "main";
  return (
    <ul className="complex-list__rows">
      {visible.map((row) => {
        const base = `${baseHref}/${row.id}`;
        return (
          <li key={row.id} className="complex-list__item">
            <ComplexRow
              row={row}
              href={complexTabHref(base, entryTab)}
              publication={access.manage}
              pending={pending.has(row.id)}
            />
            {actions ? (
              <ComplexRowActions
                row={row}
                actions={actions}
                publicationHref={complexTabHref(base, "publication")}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

type PublicationPillsProps = {
  rows: readonly ComplexListRow[];
  developerId: string | null;
  filters: readonly PublicationFilter[];
  value: PublicationFilter;
  onChange: (filter: PublicationFilter) => void;
};

function PublicationPills({ rows, developerId, filters, value, onChange }: PublicationPillsProps) {
  const t = useTranslations("admin.complexes");
  const counts = useMemo(() => complexFilterCounts(rows, developerId), [rows, developerId]);
  const pills = filters.map((key) => ({ key, label: t(`filters.${key}`), count: counts[key] }));
  return <FilterPills label={t("filtersLabel")} pills={pills} value={value} onChange={onChange} />;
}

type ComplexRowProps = { row: ComplexListRow; href: string; publication: boolean; pending: boolean };

function ComplexRow({ row, href, publication, pending }: ComplexRowProps) {
  const t = useTranslations("admin.complexes");
  const name = t("namePrefixed", { name: row.name.ru });
  return (
    // Имя ссылки — всё содержимое строки: диктор слышит остатки, состояние и «скрыт застройщиком».
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
          <ComplexStateBadge
            status={row.status}
            siteState={row.siteState ?? null}
            developerPublished={row.developerStatus === "published"}
          />
          {pending ? <PendingRequestBadge /> : null}
        </span>
      ) : null}
      <ChevronRight className="complex-list__chevron" size={18} aria-hidden="true" />
    </Link>
  );
}

/** «Фергана · Farg‘ona Sifat Qurilish»; у архива — дата окончательного удаления. */
function metaLine(row: ComplexListRow, t: Translate): string {
  const parts = [row.locationName ?? t("noLocation"), row.developerName ?? t("noDeveloper")];
  if (row.status === "archived" && row.archivedAt) {
    parts.push(t("archivedUntil", { date: formatDate(deletionDate(row.archivedAt)) }));
  }
  return parts.join(" · ");
}
