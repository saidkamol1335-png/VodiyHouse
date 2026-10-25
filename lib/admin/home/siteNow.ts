import type { LocalizedText } from "@/lib/contacts";
import type { Device, EventType } from "@/lib/events/types";
import { filterFromSearch, searchFromFilter } from "@/lib/site/catalog/params";

// «Сейчас на сайте» на главной кабинета (шаг 3.12, мокап CabHome): онлайн за 5 минут и восемь
// последних действий посетителей (site_now()). Без данных человека: что сделали, откуда пришли, с чего.

export type SiteNowItem = {
  at: string;
  type: Exclude<EventType, "page_view">;
  detail: string | null;
  source: string | null;
  device: Device;
  complex: LocalizedText | null;
  /** Адрес страницы — только у фильтра: что выбрано, читаем из параметров каталога. */
  path?: string | null;
};

export type SiteNow = { online: number; feed: SiteNowItem[] };

export type SiteNowResult = { status: "done"; now: SiteNow } | { status: "error"; error: string };

/**
 * «komnat 2, cenaDo 45000» — фильтр каталога из адреса события: только параметры, которые сайт
 * понимает сам (filterFromSearch), — чужой текст в ленту кабинета не попадает.
 */
export function filterDetail(path: string | null | undefined): string | null {
  const query = path?.split("?")[1];
  if (!query) return null;
  const search = searchFromFilter(filterFromSearch(Object.fromEntries(new URLSearchParams(query))));
  const text = [...new URLSearchParams(search)].map(([key, value]) => `${key} ${value}`).join(", ");
  return text || null;
}

export function siteNowFrom(raw: unknown): SiteNow {
  const value = (raw ?? {}) as Partial<SiteNow>;
  const feed = Array.isArray(value.feed) ? value.feed : [];
  return {
    online: Number(value.online ?? 0),
    feed: feed.map((item) => (item.type === "filter" ? { ...item, detail: filterDetail(item.path) } : item)),
  };
}
