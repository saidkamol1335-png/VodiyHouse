"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CALC_PARAM_KEYS,
  type CalcParams,
  readCalcParams,
  writeCalcParams,
} from "@/lib/calc/params";

/** Ключи расчёта — из состояния; чужие (utm_*, ?plan= страницы ЖК) остаются в адресе как были. */
export function searchWith(current: string, params: CalcParams): string {
  const search = new URLSearchParams(current);
  for (const key of CALC_PARAM_KEYS) search.delete(key);
  for (const [key, value] of writeCalcParams(params)) search.set(key, value);
  return search.toString();
}

const normalized = (search: string) => new URLSearchParams(search).toString();

// Параметры по адресу, как их читает сервер; застройщика без ?developer= выбирает сервер —
// он в initial.
const fromSearch = (search: string, initial: CalcParams): CalcParams => ({
  ...readCalcParams(new URLSearchParams(search)),
  developer: initial.developer,
});

/**
 * Ключ расчёта в адресе спорит с initial (застройщика не считаем — его выбирает сервер). Ключа
 * нет или в нём мусор — спора нет: сервер строит initial из адреса тем же readCalcParams.
 */
export function searchContradicts(search: string, initial: CalcParams): boolean {
  const fromUrl = readCalcParams(new URLSearchParams(search));
  return (Object.keys(fromUrl) as (keyof CalcParams)[]).some(
    (key) => key !== "developer" && fromUrl[key] !== null && fromUrl[key] !== initial[key],
  );
}

/**
 * Адрес сменили снаружи (пример, «Назад», тот же пример ещё раз) — расчёт заново с него. Свои
 * записи Next.js отдаёт с задержкой: пока они в pending, это не «снаружи», сброса нет.
 */
function useExternalSearch(search: string, onExternal: (search: string) => void) {
  const [seen, setSeen] = useState(search);
  const [pending, setPending] = useState<readonly string[]>([]);
  if (search !== seen) {
    setSeen(search);
    // Роутер мог пропустить промежуточные записи: ищем последнюю такую, всё до неё — уже не ждём.
    const own = pending.lastIndexOf(search);
    setPending(own === -1 ? [] : pending.slice(own + 1));
    if (own === -1) onExternal(search);
  } else if (pending.length > 0 && pending.at(-1) === search) {
    // Роутер догнал последнюю запись (жест вернул адрес к прежнему) — ждать больше нечего.
    setPending([]);
  }
  return (written: string) => setPending((list) => [...list, normalized(written)]);
}

let navigatingUntil = 0;
const NAVIGATION_WAIT_MS = 3000;

/**
 * Переход начат (пилюля застройщика, пример): пока сервер не ответил, адрес не пишем — запись
 * адреса для Next.js — «восстановление», и оно отменило бы идущий переход. Расчёт после перехода
 * всё равно начнётся с нового адреса; ответа нет дольше 3 с — пишем снова.
 */
export function markCalcNavigation() {
  navigatingUntil = Date.now() + NAVIGATION_WAIT_MS;
}

type CalcParamsOptions = {
  /** Начальные параметры, как их готовит экран (закрепить стоимость под программу из адреса). */
  pin: (params: CalcParams) => CalcParams;
  /**
   * initial построен сервером из адреса (/kalkulyator, «Расчёт для клиента»). После «Назад» →
   * «Вперёд» роутер Next.js восстанавливает страницу из своего кэша: пропсы — от прежнего адреса
   * (пример), адрес — уже с правкой; тогда при монтировании адрес главнее, иначе экран расходится
   * со ссылкой (e2e site-calc «Назад» / «Вперёд», 28.10.2026). Расчёт квартиры стартует с пустых
   * параметров — ключи в адресе страницы ЖК ему не указ.
   */
  fromUrl: boolean;
};

/**
 * Параметры расчёта в состоянии и в адресе (одна схема ключей кабинета и сайта): ссылкой
 * можно поделиться, «обновить» не сбрасывает расчёт. Адрес меняется без перехода и перерисовки.
 */
export function useCalcParams(initial: CalcParams, { pin, fromUrl }: CalcParamsOptions) {
  const search = normalized(useSearchParams().toString());
  const [params, setParams] = useState(() =>
    pin(fromUrl && searchContradicts(search, initial) ? fromSearch(search, initial) : initial),
  );
  const wrote = useExternalSearch(search, (next) => {
    navigatingUntil = 0;
    setParams(fromSearch(next, initial));
  });
  // Новый расчёт (переход закончился сменой застройщика или планировки) — адрес снова наш.
  useEffect(() => {
    navigatingUntil = 0;
  }, []);
  const update = (patch: Partial<CalcParams>) => {
    const next = { ...params, ...patch };
    setParams(next);
    if (Date.now() < navigatingUntil) return;
    const url = new URL(window.location.href);
    url.search = searchWith(url.search, next);
    if (url.search === window.location.search) return;
    wrote(url.search);
    // null, а не history.state Next.js: только так роутер узнаёт новый адрес (useSearchParams,
    // примеры) — со своим состоянием он счёл бы вызов своим и не обновился.
    window.history.replaceState(null, "", url);
  };
  return { params, update };
}
