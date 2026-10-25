"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flatCalcFrom, type FlatCalcScreen } from "@/lib/calc/flatScreen";
import { getMotionTier } from "@/lib/motion";
import { readLayoutCalcAction } from "@/lib/site/complex/actions";
import type { LayoutFilter } from "@/lib/site/complex/layouts";
import { parseLayoutsLink, type LayoutsTarget } from "@/lib/site/complex/layoutsLink";

type OpenCalc = { layoutId: string; screen: FlatCalcScreen; round: number };

/**
 * Калькулятор квартиры — отдельным чанком вместе со своими стилями (app/calc.css): страница ЖК не
 * тянет ни код, ни ~8 КБ стилей до первого «Рассчитать платёж» — стили не блокируют первый экран.
 */
export const loadFlatCalculator = () =>
  Promise.all([import("@/components/FlatCalculator"), import("@/app/calc.css")]).then(([module]) => module.FlatCalculator);

/**
 * Расчёт планировки: данные — по нажатию (site_layout_calc), ошибка и сбой сети — у кнопки этой
 * планировки; повторное нажатие у открытого расчёта сворачивает его (мокап «Свернуть»); закрыли —
 * фокус на «Рассчитать платёж» той планировки, расчёт которой закрыли.
 */
export function useLayoutCalc() {
  const [open, setOpen] = useState<OpenCalc | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const openers = useRef(new Map<string, HTMLButtonElement>());
  const calculate = (layoutId: string) => {
    setPending(layoutId);
    setFailed(null);
    startTransition(async () => {
      // Ждём и данные, и код калькулятора: «Считаем…» держится, пока оба не пришли; не загрузился
      // чанк (связь, новый деплой) — ошибка у кнопки, а не экран ошибки вместо страницы.
      const [record] = await Promise.all([readLayoutCalcAction(layoutId), loadFlatCalculator()]).catch(() => [null]);
      setPending(null);
      if (!record) return setFailed(layoutId);
      setOpen((current) => ({ layoutId, screen: flatCalcFrom(record), round: (current?.round ?? 0) + 1 }));
    });
  };
  const close = () => {
    if (open) openers.current.get(open.layoutId)?.focus();
    setOpen(null);
  };
  const toggle = (layoutId: string) => (open?.layoutId === layoutId ? close() : calculate(layoutId));
  const opener = (layoutId: string) => (node: HTMLButtonElement | null) => {
    if (node) openers.current.set(layoutId, node);
    else openers.current.delete(layoutId);
  };
  return { open, pending, failed, calculate, close, toggle, opener };
}

/** К карточке планировки, расчёт которой открываем (там и ошибка расчёта), иначе — к разделу. */
const scrollToTarget = (sectionId: string, plan: string | null) =>
  // plan — из адреса: экранируем, кривой «#planirovki?plan=…» не ломает селектор.
  ((plan ? document.querySelector(`[data-layout-id="${CSS.escape(plan)}"]`) : null) ?? document.getElementById(sectionId))?.scrollIntoView({
    behavior: getMotionTier() === "full" ? "smooth" : "auto",
    block: plan ? "center" : "start",
  });

/**
 * Переходы к «Планировкам»: ссылка с data-layouts (карточка блока, строка «Наличия») или запрос в
 * адресе («#planirovki?komnat=2»). Фильтр — сразу; «plan» — открыть расчёт этой планировки.
 */
export function useLayoutsTarget(sectionId: string, setFilter: (filter: LayoutFilter) => void, openPlan: (layoutId: string) => void) {
  const openPlanRef = useRef(openPlan);
  useEffect(() => {
    openPlanRef.current = openPlan;
  });
  useEffect(() => {
    const apply = (target: LayoutsTarget | null) => {
      if (!target || (target.plan === null && target.blockId === null && target.rooms === null)) return;
      setFilter({ blockId: target.plan ? null : target.blockId, rooms: target.plan ? null : target.rooms });
      if (target.plan) openPlanRef.current(target.plan);
      // После перерисовки с новым фильтром — карточка уже на месте.
      requestAnimationFrame(() => scrollToTarget(sectionId, target.plan));
    };
    const fromHash = () => {
      const target = parseLayoutsLink(window.location.hash);
      if (!target) return;
      history.replaceState(null, "", `#${sectionId}`);
      apply(target);
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[data-layouts]");
      // Ctrl/Cmd/Shift-клик — новая вкладка браузера, его не перехватываем.
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      apply(parseLayoutsLink(`#${sectionId}?${link.getAttribute("data-layouts") ?? ""}`));
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("click", onClick);
    };
  }, [sectionId, setFilter]);
}
