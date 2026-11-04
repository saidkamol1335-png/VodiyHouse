"use client";

import { useRef, useState } from "react";
import { REALTOR_PARAM_KEYS, writeRealtorParams } from "@vh/shared/calc/realtorParams";
import { type RealtorState, paramsOf } from "./realtorState";

/** Ключи расчёта — из состояния; чужие (utm_*, ?developer= старых ссылок) остаются как были. */
export function realtorSearch(current: string, state: RealtorState): string {
  const search = new URLSearchParams(current);
  for (const key of REALTOR_PARAM_KEYS) search.delete(key);
  for (const [key, value] of writeRealtorParams(paramsOf(state))) search.set(key, value);
  return search.toString();
}

/**
 * Состояние калькулятора и адрес (PLAN §10, п. 48): ссылкой можно поделиться, «обновить» и смена
 * языка не сбрасывают расчёт. Адрес меняется без перехода: страницу заново не строим.
 */
export function useRealtorState(initial: RealtorState) {
  const [state, setState] = useState(initial);
  // Две правки в одном событии (формат поля на blur и срок) — вторая считается от первой.
  const latest = useRef(initial);
  const update = (patch: Partial<RealtorState> | ((state: RealtorState) => RealtorState)) => {
    const current = latest.current;
    const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
    latest.current = next;
    setState(next);
    const url = new URL(window.location.href);
    url.search = realtorSearch(url.search, next);
    if (url.search === window.location.search) return;
    // null, а не history.state Next.js: так роутер узнаёт новый адрес (как у useCalcParams).
    window.history.replaceState(null, "", url);
  };
  return { state, update };
}
