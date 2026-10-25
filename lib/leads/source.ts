import { SOURCE_KEYS, type LeadSource } from "./types";

// Источник первого захода (ТЗ 10.3): метки из адреса и откуда пришли — при первом открытии сайта,
// заявка передаёт их, даже если оставлена позже на другой странице. Хранится в браузере
// посетителя; хранилище недоступно (приватный режим) — помним до закрытия вкладки.
// Реши сам: заход без меток не закрепляется навсегда — следующий заход с рекламы его заменит.

const STORAGE_KEY = "vh.source";
const AD_KEYS = SOURCE_KEYS.filter((key) => key !== "referrer" && key !== "landing");

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

/** Первый заход (или первый с рекламы после заходов без меток) — запомнить. */
export function rememberVisitSource(href: string, referrer: string): void {
  const visit = sourceOfVisit(href, referrer);
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
