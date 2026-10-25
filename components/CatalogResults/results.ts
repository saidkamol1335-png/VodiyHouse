"use client";

import { useEffect, useRef } from "react";
import type { LeadIntent } from "@/components/LeadForm";
import { track } from "@/lib/events/client";
import type { CatalogFilter as Filter } from "@/lib/site/catalog/filter";
import { searchFromFilter } from "@/lib/site/catalog/params";

// Каталог (шаги 3.4, 3.12): заявка «Подбор» с фильтрами, событие «фильтр» для ленты кабинета и
// фокус после «Показать ещё» — отдельно от разметки выдачи.

/** Фильтр текстом: «komnat 2, do 45000» — для заявки «Подбор». */
function filterText(filter: Filter): string {
  return [...new URLSearchParams(searchFromFilter(filter))].map(([key, value]) => `${key} ${value}`).join(", ");
}

/**
 * «Подберём вручную» (ТЗ 10.1): заявка «Подбор» с фильтрами — текстом для менеджера («komnat 2,
 * do 60000») и ссылкой на ту же выдачу.
 */
export function pickIntent(filter: Filter): LeadIntent {
  return { type: "pick", filters: { text: filterText(filter), link: `${window.location.pathname}${searchFromFilter(filter)}` } };
}

const FILTER_TRACK_MS = 1500;

/**
 * Событие «фильтр» — после паузы в выборе: каждая нажатая пилюля не становится отдельным событием.
 * Что выбрано, кабинет читает из адреса события (параметры каталога), текста от браузера нет. Ушли
 * со страницы раньше паузы — событие уходит сразу, с адресом каталога, а не новой страницы.
 */
export function useFilterTracking() {
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

/**
 * «Показать ещё» с клавиатуры: фокус — на первую новую карточку. После последней порции кнопка
 * исчезает, и без этого фокус ушёл бы в body.
 */
export function useFocusOnMore(shown: number, onMore: () => void) {
  const list = useRef<HTMLDivElement>(null);
  const firstNew = useRef<number | null>(null);
  useEffect(() => {
    if (firstNew.current === null) return;
    list.current?.querySelectorAll<HTMLAnchorElement>(".catalog-card__link")[firstNew.current]?.focus();
    firstNew.current = null;
  }, [shown]);
  const more = () => {
    firstNew.current = shown;
    onMore();
  };
  return { list, more };
}
