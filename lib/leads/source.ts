import { AD_KEYS, LANDING_COOKIE } from "./landing";
import type { LeadSource } from "./types";

// Источник первого захода (ТЗ 10.3): метки из адреса и откуда пришли — при первом открытии сайта,
// заявка передаёт их, даже если оставлена позже на другой странице. Хранится в браузере
// посетителя; хранилище недоступно (приватный режим) — помним до закрытия вкладки.
// Реши сам: заход без меток не закрепляется навсегда — следующий заход с рекламы его заменит.

const STORAGE_KEY = "vh.source";

let memory: LeadSource | null = null;

const hasAdMarks = (source: LeadSource) => AD_KEYS.some((key) => source[key]);

/** Метки этого захода: utm_*, fbclid, gclid из адреса; чужой referrer — домен; страница входа. */
export function sourceOfVisit(href: string, referrer: string): LeadSource {
  const url = new URL(href);
  const source: LeadSource = {};
  for (const key of AD_KEYS) {
    const value = url.searchParams.get(key)?.trim();
    if (value) source[key] = value.slice(0, 200);
  }
  if (referrer) {
    const from = new URL(referrer, href);
    if (from.host !== url.host) source.referrer = from.host;
  }
  source.landing = url.pathname;
  return source;
}

function readStored(): LeadSource | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeadSource) : memory;
  } catch {
    return memory;
  }
}

/** Адрес захода, который proxy сохранил перед редиректом со старого адреса ЖК; читается один раз. */
function takeLandingHref(href: string): string | null {
  const match = new RegExp(`(?:^|;\\s*)${LANDING_COOKIE}=([^;]*)`).exec(document.cookie);
  if (!match) return null;
  document.cookie = `${LANDING_COOKIE}=; max-age=0; path=/`;
  try {
    const landing = new URL(decodeURIComponent(match[1]!), href);
    return landing.origin === new URL(href).origin ? landing.href : null;
  } catch {
    return null;
  }
}

/** Первый заход (или первый с рекламы после заходов без меток) — запомнить. */
export function rememberVisitSource(href: string, referrer: string): void {
  const here = sourceOfVisit(href, referrer);
  const landing = hasAdMarks(here) ? null : takeLandingHref(href);
  const visit = landing ? sourceOfVisit(landing, referrer) : here;
  const stored = readStored();
  if (stored && (hasAdMarks(stored) || !hasAdMarks(visit))) return;
  memory = visit;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(visit));
  } catch {
    // Хранилище закрыто — остаётся память вкладки.
  }
}

/** Что уйдёт с заявкой; ничего не запомнено (стенд, первая загрузка) — этот заход. */
export function leadSource(): LeadSource {
  return readStored() ?? sourceOfVisit(window.location.href, document.referrer);
}
