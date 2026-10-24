"use client";

import { useState } from "react";
import { type CalcParams, writeCalcParams } from "@/lib/calc/params";

/**
 * Параметры расчёта в состоянии и в адресе (одна схема ключей кабинета и сайта): ссылкой
 * можно поделиться, «обновить» не сбрасывает расчёт. Адрес меняется без перехода и перерисовки.
 */
export function useCalcParams(initial: CalcParams) {
  const [params, setParams] = useState(initial);
  const update = (patch: Partial<CalcParams>) => {
    const next = { ...params, ...patch };
    setParams(next);
    const url = new URL(window.location.href);
    url.search = writeCalcParams(next).toString();
    window.history.replaceState(window.history.state, "", url);
  };
  return { params, update };
}
