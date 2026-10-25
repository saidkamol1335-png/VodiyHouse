"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { CatalogFilter } from "@/components/CatalogFilter";
import { CatalogGrid } from "@/components/CatalogGrid";
import { SelectField } from "@/components/SelectField";
import { getMotionTier } from "@/lib/motion";
import { CATALOG_SORTS, NO_FILTER, type CatalogFilter as Filter, type CatalogSort } from "@/lib/site/catalog/filter";
import { searchFromFilter } from "@/lib/site/catalog/params";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { filterCatalog } from "@/lib/site/catalog/sort";

type CatalogResultsProps = {
  catalog: SiteCatalog;
  /** Фильтр из адреса (ссылка менеджера и «Поделиться» открываются сразу на результатах, Ф3). */
  initialFilter: Filter;
  /** Карточек на «порцию»: «Показать ещё» добавляет столько же. */
  pageSize: number;
};

/** Сколько групп фильтра задано — счётчик на кнопке «Фильтры» телефона. */
function activeGroups(filter: Filter): number {
  const keys = (Object.keys(filter) as (keyof Filter)[]).filter((key) => key !== "sort");
  return keys.filter((key) => JSON.stringify(filter[key]) !== JSON.stringify(NO_FILTER[key])).length;
}

/**
 * Каталог (Ф3, мокап .cat): фильтр, «Найдено N ЖК», сортировка, карточки порциями и пустой
 * результат. Фильтр живёт в браузере и в адресе — без перехода страницы (history.replaceState).
 */
export function CatalogResults({ catalog, initialFilter, pageSize }: CatalogResultsProps) {
  const t = useTranslations("catalog");
  const [filter, setFilter] = useState(initialFilter);
  const [shown, setShown] = useState(pageSize);
  const [open, setOpen] = useState(false);
  const results = useRef<HTMLDivElement>(null);
  const found = useMemo(() => filterCatalog(catalog, filter), [catalog, filter]);
  useSheetLock(open, () => setOpen(false));
  const change = (next: Filter) => {
    setFilter(next);
    setShown(pageSize);
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${searchFromFilter(next)}`);
  };
  const showResults = () => {
    setOpen(false);
    results.current?.scrollIntoView({ behavior: getMotionTier() === "full" ? "smooth" : "auto", block: "start" });
  };
  return (
    <div className="catalog-results">
      <CatalogFilter catalog={catalog} filter={filter} onChange={change} found={found.length} open={open} onClose={() => setOpen(false)} onShow={showResults} />
      <ResultsTop ref={results} found={found.length} filter={filter} onChange={change} onOpenFilter={() => setOpen(true)} />
      {found.length > 0 ? (
        <CatalogGrid catalog={catalog} complexes={found.slice(0, shown)} />
      ) : (
        <div className="catalog-results__empty">
          <h3>{t("filter.nothing")}</h3>
          <p>{t("filter.nothingHint")}</p>
        </div>
      )}
      {found.length > shown ? (
        <div className="catalog-results__more">
          <Button variant="outline" onClick={() => setShown(shown + pageSize)}>
            {t("filter.more", { n: Math.min(pageSize, found.length - shown) })}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

type ResultsTopProps = {
  ref: React.Ref<HTMLDivElement>;
  found: number;
  filter: Filter;
  onChange: (next: Filter) => void;
  onOpenFilter: () => void;
};

/** «Найдено N ЖК», «Фильтры» с числом заданных (телефон) и сортировка (мокап .res__top). */
function ResultsTop({ ref, found, filter, onChange, onOpenFilter }: ResultsTopProps) {
  const t = useTranslations("catalog");
  const groups = activeGroups(filter);
  const sorts = CATALOG_SORTS.map((sort) => ({ value: sort, label: t(`filter.sorts.${sort}`) }));
  return (
    <div ref={ref} className="catalog-results__top">
      <p className="catalog-results__count" aria-live="polite">
        {t("page.found", { n: found })}
      </p>
      <div className="catalog-results__tools">
        <Button variant="outline" size="sm" className="catalog-results__filters" onClick={onOpenFilter}>
          <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden />
          {t("filter.label")}
          {groups > 0 ? <Badge tone="amber" size="sm">{groups}</Badge> : null}
        </Button>
        <SelectField id="catalog-sort" label={t("filter.sort")} className="catalog-results__sort" value={filter.sort} options={sorts} onChange={(event) => onChange({ ...filter, sort: event.target.value as CatalogSort })} />
      </div>
    </div>
  );
}

/** Фильтр телефона на весь экран: Escape закрывает (прокрутку под ним гасит CSS, как у меню). */
function useSheetLock(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
}
