"use client";

import type { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import type { LeadIntent } from "@/components/LeadForm";
import { track } from "@/lib/events/client";
import type { FilterLabels } from "@/lib/site/catalog/describe";
import { PAYMENT_KINDS, type CatalogFilter as Filter, type PaymentKind } from "@/lib/site/catalog/filter";
import { searchFromFilter } from "@/lib/site/catalog/params";

// Каталог (шаги 3.4, 3.12): заявка «Подбор» с фильтрами, событие «фильтр» для ленты кабинета и
// фокус после «Показать ещё» — отдельно от разметки выдачи.

/**
 * «Подберём вручную» (ТЗ 10.1): заявка «Подбор» с фильтрами — словами для менеджера и плашки окна
 * («Комнаты: 2 · Цена квартиры, $: до $60 000», lib/site/catalog/describe.ts) и ссылкой на ту же выдачу.
 */
export function pickIntent(filter: Filter, text: string): LeadIntent {
  return {
    type: "pick",
    context: text || undefined,
    filters: { text, link: `${window.location.pathname}${searchFromFilter(filter)}` },
  };
}

type CatalogTranslator = ReturnType<typeof useTranslations<"catalog">>;

/** Подписи фильтра для describeFilter — из messages каталога (те же, что у чипов фильтра). */
export function filterLabels(t: CatalogTranslator): FilterLabels {
  const payments = Object.fromEntries(PAYMENT_KINDS.map((kind) => [kind, t(`filter.payments.${kind}`)]));
  return {
    rooms: t("filter.rooms"),
    studio: t("card.rooms.0"),
    price: t("filter.price"),
    priceFrom: t("filter.priceFrom"),
    priceTo: t("filter.priceTo"),
    location: t("filter.location"),
    payment: t("filter.payment"),
    payments: payments as Record<PaymentKind, string>,
    deadline: t("filter.deadline"),
    deadlineBuilt: t("filter.deadlineBuilt"),
    deadlineUpTo: (year) => t("filter.deadlineUpTo", { year }),
    developer: t("filter.developer"),
    finishing: t("filter.finishing"),
  };
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
    const search = searchFromFilter(next);
    pending.current = search ? `${window.location.pathname}${search}` : null;
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
