import { leadSource } from "@/lib/leads/source";
import { EVENT_BATCH_MAX, type EventBatch, type SiteEvent } from "./types";

// Очередь событий в браузере (шаг 3.12): события копятся и уходят пачкой раз в несколько секунд и
// при уходе со страницы (sendBeacon переживает закрытие вкладки). Сотрудник с сессией кабинета и
// стенды /dev — не считаются. Рекламные пиксели получают те же события (lib/events/pixels.ts).

const ENDPOINT = "/api/e";
const FLUSH_MS = 4000;
const AUTH_COOKIE = /(?:^|;\s*)sb-[^=.]+-auth-token(?:\.\d+)?=/;

type Listener = (event: SiteEvent) => void;

const queue: SiteEvent[] = [];
/** ЖК страницы (TrackView): клики «Позвонить», «Telegram», заявки на ней — про этот ЖК (только
 *  пока открыт тот же адрес: ушли со страницы — контекст не действует). */
let context: { pathname: string; entity: Pick<SiteEvent, "entity_type" | "entity_id"> } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();

const isStaff = () => AUTH_COOKIE.test(document.cookie) || window.location.pathname.startsWith("/dev");

/** Источник для ленты: utm_source первого захода или домен, откуда пришли. */
function sourceLabel(): string | null {
  const source = leadSource();
  return source.utm_source ?? source.referrer ?? null;
}

function langOf(): EventBatch["lang"] {
  return document.documentElement.lang === "ru" ? "ru" : "uz";
}

export function flushEvents(): void {
  clearTimeout(timer);
  timer = undefined;
  if (queue.length === 0) return;
  const batch: EventBatch = { events: queue.splice(0, EVENT_BATCH_MAX), lang: langOf(), source: sourceLabel() };
  const body = JSON.stringify(batch);
  const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
  if (!sent) void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
  if (queue.length > 0) timer = setTimeout(flushEvents, FLUSH_MS);
}

/** Редкие и ценные действия уходят сразу: посетитель может тут же закрыть вкладку. */
const URGENT: ReadonlySet<SiteEvent["type"]> = new Set(["lead_sent", "phone_click", "telegram_click", "favorite", "share"]);
/** То же событие в ту же секунду — один раз (двойной вызов эффекта, двойное нажатие). */
const REPEAT_MS = 1000;
let last: { key: string; at: number } | null = null;

/** Действие посетителя: в очередь своих событий и рекламным пикселям. */
export function track(type: SiteEvent["type"], data: Omit<SiteEvent, "type" | "path"> = {}): void {
  try {
    record(type, data);
  } catch (error) {
    // Счётчик не ломает сайт: кнопка уже сделала своё.
    console.warn("[events] событие не записано", error);
  }
}

function record(type: SiteEvent["type"], data: Omit<SiteEvent, "type" | "path">): void {
  if (typeof window === "undefined" || isStaff()) return;
  const path = `${window.location.pathname}${window.location.search}`.slice(0, 300);
  const here = context?.pathname === window.location.pathname ? context.entity : {};
  const event: SiteEvent = { type, path, ...(data.entity_id ? {} : here), ...data };
  const key = JSON.stringify(event);
  if (last && last.key === key && Date.now() - last.at < REPEAT_MS) return;
  last = { key, at: Date.now() };
  queue.push(event);
  for (const listener of listeners) listener(event);
  if (URGENT.has(type)) flushEvents();
  else timer ??= setTimeout(flushEvents, FLUSH_MS);
}

/** Подписка рекламных пикселей на события (до загрузки их скриптов события ждут в их очереди). */
export function onTrack(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ЖК открытой страницы (TrackView). */
export function setTrackContext(entity: Pick<SiteEvent, "entity_type" | "entity_id">): void {
  context = { pathname: window.location.pathname, entity };
}

const ENTITY = /^(complex|layout|developer):([0-9a-f-]{36})$/i;

/**
 * Клик по ссылке «tel:» или элементу с data-track="<тип>" (Telegram, «Поделиться»): тип, подпись
 * (data-track-detail) и объект ближайшей карточки (data-track-entity="complex:<id>").
 */
export function trackClick(target: EventTarget | null): void {
  if (!(target instanceof Element)) return;
  const element = target.closest<HTMLElement>('[data-track], a[href^="tel:"]');
  if (!element || element.hasAttribute("data-track-ignore")) return;
  const type = (element.dataset.track ?? "phone_click") as SiteEvent["type"];
  const entity = ENTITY.exec(element.closest<HTMLElement>("[data-track-entity]")?.dataset.trackEntity ?? "");
  track(type, {
    ...(element.dataset.trackDetail ? { detail: element.dataset.trackDetail } : {}),
    ...(entity ? { entity_type: entity[1] as SiteEvent["entity_type"], entity_id: entity[2] } : {}),
  });
}
