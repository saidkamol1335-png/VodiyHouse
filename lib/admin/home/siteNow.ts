import type { LocalizedText } from "@/lib/contacts";
import type { Device, EventType } from "@/lib/events/types";

// «Сейчас на сайте» на главной кабинета (шаг 3.12, мокап CabHome): онлайн за 5 минут и восемь
// последних действий посетителей (site_now()). Без данных человека: что сделали, откуда пришли, с чего.

export type SiteNowItem = {
  at: string;
  type: Exclude<EventType, "page_view">;
  detail: string | null;
  source: string | null;
  device: Device;
  complex: LocalizedText | null;
};

export type SiteNow = { online: number; feed: SiteNowItem[] };

export type SiteNowResult = { status: "done"; now: SiteNow } | { status: "error"; error: string };

export function siteNowFrom(raw: unknown): SiteNow {
  const value = (raw ?? {}) as Partial<SiteNow>;
  return { online: Number(value.online ?? 0), feed: Array.isArray(value.feed) ? value.feed : [] };
}
