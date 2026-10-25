"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { CatalogFilter } from "@/components/CatalogFilter";
import { CatalogGrid } from "@/components/CatalogGrid";
import { useLeadOpener } from "@/components/LeadDialog";
import type { LeadIntent } from "@/components/LeadForm";
import { SelectField } from "@/components/SelectField";
import { getMotionTier } from "@/lib/motion";
import { CATALOG_SORTS, NO_FILTER, type CatalogFilter as Filter, type CatalogSort } from "@/lib/site/catalog/filter";
import { filterFromSearch, searchFromFilter } from "@/lib/site/catalog/params";
import { CATALOG_PENDING_ATTRIBUTE } from "@/lib/site/catalog/pending";
import type { CatalogComplex, SiteCatalog } from "@/lib/site/catalog/records";
import { filterCatalog } from "@/lib/site/catalog/sort";
import { track } from "@/lib/events/client";

type CatalogResultsProps = {
  catalog: SiteCatalog;
  /** Карточек на «порцию»: «Показать ещё» добавляет столько же. */
  pageSize: number;
  /** false — каталог ниже первого экрана (главная): первую обложку не грузить заранее. */
  preloadFirst?: boolean;
};


/** Фильтр из адреса (ссылка менеджера и «Поделиться», Ф3) — один раз после загрузки. */
function useFilterFromAddress(apply: (filter: Filter) => void) {
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => {
    const filter = filterFromSearch(Object.fromEntries(new URLSearchParams(window.location.search)));
    if (JSON.stringify(filter) !== JSON.stringify(NO_FILTER)) applyRef.current(filter);
    document.documentElement.removeAttribute(CATALOG_PENDING_ATTRIBUTE);
  }, []);
}

/** Сколько групп фильтра задано — счётчик на кнопке «Фильтры» телефона. */
function activeGroups(filter: Filter): number {
  const keys = (Object.keys(filter) as (keyof Filter)[]).filter((key) => key !== "sort" && key !== "priceMax");
  // Цена «от … до …» — одна группа.
  const changed = (key: keyof Filter) => JSON.stringify(filter[key]) !== JSON.stringify(NO_FILTER[key]);
  return keys.filter((key) => (key === "priceMin" ? changed("priceMin") || changed("priceMax") : changed(key))).length;
}

/**
 * Каталог (Ф3, мокап .cat): фильтр, «Найдено N ЖК», сортировка, карточки порциями и пустой
 * результат. Фильтр живёт в браузере и в адресе — без перехода страницы (history.replaceState).
 */
export function CatalogResults({ catalog, pageSize, preloadFirst = true }: CatalogResultsProps) {
  const [filter, setFilter] = useState(NO_FILTER);
  const [shown, setShown] = useState(pageSize);
  const [open, setOpen] = useState(false);
  const results = useRef<HTMLDivElement>(null);
  const filtersButton = useRef<HTMLButtonElement>(null);
  const closeSheet = () => setOpen(false);
  useFocusBack(open, filtersButton);
  const found = useMemo(() => filterCatalog(catalog, filter), [catalog, filter]);
  useSheetLock(open, closeSheet);
  useFilterFromAddress(setFilter);
  const trackFilter = useFilterTracking();
  const change = (next: Filter) => {
    setFilter(next);
    setShown(pageSize);
    trackFilter(next);
    // null, а не history.state: так Next сверяет свой адрес с нашим (как useCalcParams), и обновление
    // страницы роутером не вернёт адрес без фильтра.
    window.history.replaceState(null, "", `${window.location.pathname}${searchFromFilter(next)}`);
  };
  const showResults = () => {
    setOpen(false);
    results.current?.scrollIntoView({ behavior: getMotionTier() === "full" ? "smooth" : "auto", block: "start" });
  };
  return (
    <div className="catalog-results">
      <CatalogFilter catalog={catalog} filter={filter} onChange={change} found={found.length} open={open} onClose={closeSheet} onShow={showResults} />
      {/* Пока открыт экран фильтра телефона, выдача за ним недоступна (диалог). */}
      <div className="catalog-results__body" inert={open}>
        <ResultsTop ref={results} filtersRef={filtersButton} found={found.length} filter={filter} onChange={change} onOpenFilter={() => setOpen(true)} />
        <ResultsList catalog={catalog} found={found} filter={filter} shown={shown} pageSize={pageSize} preloadFirst={preloadFirst} onMore={() => setShown(shown + pageSize)} onReset={() => change({ ...NO_FILTER, sort: filter.sort })} />
      </div>
    </div>
  );
}

type ResultsListProps = {
  catalog: SiteCatalog;
  preloadFirst: boolean;
  found: readonly CatalogComplex[];
  filter: Filter;
  shown: number;
  pageSize: number;
  onMore: () => void;
  onReset: () => void;
};

/**
 * «Подберём вручную» (ТЗ 10.1): заявка «Подбор» с фильтрами — текстом для менеджера («rooms 2,
 * price_max 60000») и ссылкой на ту же выдачу.
 */
/** Фильтр текстом: «komnat 2, do 45000» — для заявки «Подбор» и ленты «Сейчас на сайте». */
function filterText(filter: Filter): string {
  return [...new URLSearchParams(searchFromFilter(filter))].map(([key, value]) => `${key} ${value}`).join(", ");
}

function pickIntent(filter: Filter): LeadIntent {
  return { type: "pick", filters: { text: filterText(filter), link: `${window.location.pathname}${searchFromFilter(filter)}` } };
}

const FILTER_TRACK_MS = 1500;

/**
 * Событие «фильтр» — после паузы в выборе: каждая нажатая пилюля не становится отдельным событием.
 * Что выбрано, кабинет читает из адреса события (параметры каталога), текста от браузера нет. Ушли
 * со страницы раньше паузы — событие уходит сразу, с адресом каталога, а не новой страницы.
 */
function useFilterTracking() {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<string | null>(null);
  const send = () => {
    if (pending.current) track("filter", { path: pending.current });
    pending.current = null;
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      send();
    },
    [],
  );
  return (next: Filter) => {
    clearTimeout(timer.current);
    pending.current = filterText(next) ? `${window.location.pathname}${searchFromFilter(next)}` : null;
    if (pending.current) timer.current = setTimeout(send, FILTER_TRACK_MS);
  };
}

/** Карточки порциями и «Показать ещё»; пусто — «Подберём вручную» и «Сбросить фильтры». */
function ResultsList({ catalog, found, filter, shown, pageSize, preloadFirst, onMore, onReset }: ResultsListProps) {
  const t = useTranslations("catalog.filter");
  if (found.length === 0) {
    return (
      <div className="catalog-results__empty">
        <h3 className="catalog-results__empty-title">{t("nothing")}</h3>
        <p className="catalog-results__empty-hint">{t("nothingHint")}</p>
        <div className="catalog-results__empty-actions">
          <PickButton filter={filter} />
          <Button variant="outline" size="sm" onClick={onReset}>
            {t("reset")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <CatalogGrid catalog={catalog} complexes={found.slice(0, shown)} preloadFirst={preloadFirst} />
      {found.length > shown ? (
        <div className="catalog-results__more">
          <Button variant="outline" onClick={onMore}>
            {t("more", { n: Math.min(pageSize, found.length - shown) })}
          </Button>
        </div>
      ) : null}
    </>
  );
}

type ResultsTopProps = {
  ref: React.Ref<HTMLDivElement>;
  filtersRef: React.Ref<HTMLButtonElement>;
  found: number;
  filter: Filter;
  onChange: (next: Filter) => void;
  onOpenFilter: () => void;
};

/** «Найдено N ЖК», «Фильтры» с числом заданных (телефон) и сортировка (мокап .res__top). */
function ResultsTop({ ref, filtersRef, found, filter, onChange, onOpenFilter }: ResultsTopProps) {
  const t = useTranslations("catalog");
  const groups = activeGroups(filter);
  const sorts = CATALOG_SORTS.map((sort) => ({ value: sort, label: t(`filter.sorts.${sort}`) }));
  return (
    <div ref={ref} className="catalog-results__top">
      <p className="catalog-results__count" aria-live="polite">
        {t("page.found", { n: found })}
      </p>
      <div className="catalog-results__tools">
        <Button ref={filtersRef} variant="outline" size="sm" className="catalog-results__filters" onClick={onOpenFilter}>
          <SlidersHorizontal size={16} strokeWidth={1.9} aria-hidden />
          {t("filter.label")}
          {groups > 0 ? <Badge tone="amber" size="sm">{groups}</Badge> : null}
        </Button>
        <SelectField id="catalog-sort" label={t("filter.sort")} className="catalog-results__sort" value={filter.sort} options={sorts} onChange={(event) => onChange({ ...filter, sort: event.target.value as CatalogSort })} />
      </div>
    </div>
  );
}

/** Закрыли экран фильтра — фокус на «Фильтры»: после перерисовки, когда выдача уже не inert. */
function useFocusBack(open: boolean, target: React.RefObject<HTMLButtonElement | null>) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) target.current?.focus();
    wasOpen.current = open;
  }, [open, target]);
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

/** Окно заявки открывается с фильтрами на момент нажатия (адрес страницы — только в браузере). */
function PickButton({ filter }: { filter: Filter }) {
  const open = useLeadOpener();
  const t = useTranslations("lead.buttons");
  if (!open) return null;
  return (
    <Button size="sm" onClick={() => open(pickIntent(filter))}>
      {t("pick")}
    </Button>
  );
}
