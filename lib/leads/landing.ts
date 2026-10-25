import { SOURCE_KEYS } from "./types";

// Старый адрес ЖК с рекламы (шаг 3.13, ревью блока F): страница ЖК статичная и отвечает
// редиректом на каталог без параметров — метки utm_* / gclid / fbclid потерялись бы. Proxy кладёт
// адрес захода с метками в короткую cookie, первый экран сайта берёт метки из неё (lib/leads/source.ts).

export const LANDING_COOKIE = "vh-landing";
export const LANDING_MAX_AGE = 60;
const LANDING_MAX_LENGTH = 1000;

export const AD_KEYS = SOURCE_KEYS.filter((key) => key !== "referrer" && key !== "landing");

export const hasAdParams = (params: URLSearchParams) => AD_KEYS.some((key) => params.get(key)?.trim());

/** Адрес захода для cookie: только путь и параметры, не длиннее лимита cookie. */
export function landingValue(pathname: string, search: string): string | null {
  const value = `${pathname}${search}`;
  return value.length <= LANDING_MAX_LENGTH ? value : null;
}
