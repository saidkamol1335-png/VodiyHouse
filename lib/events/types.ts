// События сайта (шаг 3.12): что шлёт браузер и что пишет база (миграция 20261026130000_events.sql).
// Без импортов SDK — модуль читают и браузер, и сервер.

export const EVENT_TYPES = [
  "page_view",
  "complex_view",
  "phone_click",
  "telegram_click",
  "favorite",
  "share",
  "filter",
  "lead_sent",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
export type EventEntity = "complex" | "layout" | "developer";
export type Device = "mobile" | "tablet" | "desktop";

/** Одно действие посетителя; detail — подпись ленты «Сейчас на сайте» (фильтр текстом, канал). */
export type SiteEvent = {
  type: EventType;
  path?: string;
  entity_type?: EventEntity;
  entity_id?: string;
  detail?: string;
};

/** Пачка от браузера: события, язык страницы и источник первого захода (utm_source или домен). */
export type EventBatch = { events: SiteEvent[]; lang: "ru" | "uz"; source: string | null };

/** Сколько событий за раз отправляет браузер (база всё равно возьмёт не больше 20). */
export const EVENT_BATCH_MAX = 20;
