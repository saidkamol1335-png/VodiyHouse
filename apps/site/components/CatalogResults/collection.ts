"use client";

import { useEffect, useRef, useState } from "react";
import { NO_FILTER, type CatalogFilter as Filter } from "@/lib/site/catalog/filter";
import { filterFromSearch } from "@/lib/site/catalog/params";
import { CATALOG_PENDING_ATTRIBUTE, COLLECTION_PARAM } from "@/lib/site/catalog/pending";
import { collectionBySlug, collectionFilter, searchWithCollection } from "@/lib/site/showcase/model";
import type { ShowcaseCollection } from "@/lib/site/showcase/records";

// Фильтр и подборка витрины в каталоге (Ф3, 3.16б): живут в браузере и в адресе без перехода
// страницы. Клик по подборке ставит её фильтр (вручную — ограничивает выдачу её ЖК), правка
// фильтра снимает подборку (смена сортировки — нет), повторный клик сбрасывает всё;
// адрес — ?podborka=slug и параметры фильтра, как у ссылки менеджера.

export type CatalogSelection = { filter: Filter; collection: ShowcaseCollection | null };

const NO_SELECTION: CatalogSelection = { filter: NO_FILTER, collection: null };

const withoutSort = (filter: Filter) => JSON.stringify({ ...filter, sort: NO_FILTER.sort });
/** Задана только сортировка — по такому адресу подборка ставит свой фильтр. */
const onlySort = (filter: Filter) => withoutSort(filter) === withoutSort(NO_FILTER);

/** Выбор из адреса (ссылка менеджера и «Поделиться»): параметры фильтра и подборка. */
export function selectionFromSearch(search: string, collections: readonly ShowcaseCollection[]): CatalogSelection {
  const params = Object.fromEntries(new URLSearchParams(search));
  const filter = filterFromSearch(params);
  const collection = collectionBySlug(collections, params[COLLECTION_PARAM]);
  if (collection && onlySort(filter)) return { collection, filter: { ...collectionFilter(collection), sort: filter.sort } };
  return { filter, collection };
}

/** Фильтр и подборка выдачи; onChange — посетитель поменял выбор (порция сначала, событие «фильтр»). */
export function useCatalogSelection(collections: readonly ShowcaseCollection[], onChange: (filter: Filter) => void) {
  const [selection, setSelection] = useState(NO_SELECTION);
  const collectionsRef = useRef(collections);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    collectionsRef.current = collections;
    onChangeRef.current = onChange;
  });
  // Из адреса — один раз после загрузки; выдача до того скрыта (CATALOG_PENDING_ATTRIBUTE).
  useEffect(() => {
    const initial = selectionFromSearch(window.location.search, collectionsRef.current);
    if (initial.collection || JSON.stringify(initial.filter) !== JSON.stringify(NO_FILTER)) setSelection(initial);
    document.documentElement.removeAttribute(CATALOG_PENDING_ATTRIBUTE);
  }, []);

  const apply = (next: CatalogSelection) => {
    setSelection(next);
    onChangeRef.current(next.filter);
    // null, а не history.state: так Next сверяет свой адрес с нашим (как useCalcParams), и обновление
    // страницы роутером не вернёт адрес без фильтра.
    window.history.replaceState(null, "", `${window.location.pathname}${searchWithCollection(next.filter, next.collection?.slug ?? null)}`);
  };
  const reset = () => apply({ filter: { ...NO_FILTER, sort: selection.filter.sort }, collection: null });
  return {
    ...selection,
    /** Посетитель правит фильтр: подборка остаётся только при смене сортировки. */
    change: (next: Filter) => {
      const keep = selection.collection && withoutSort(next) === withoutSort(selection.filter);
      apply({ filter: next, collection: keep ? selection.collection : null });
    },
    /** Клик по подборке; по выбранной — сброс. */
    pick: (collection: ShowcaseCollection) => {
      if (selection.collection?.id === collection.id) reset();
      else apply({ collection, filter: { ...collectionFilter(collection), sort: selection.filter.sort } });
    },
    reset,
  };
}
