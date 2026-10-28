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
  /** Заголовок рекламы (3.16б) — у клика по рекламе на главной. */
  ad?: LocalizedText | null;
};

export type SiteNow = { online: number; feed: SiteNowItem[] };

export type SiteNowResult = { status: "done"; now: SiteNow } | { status: "error"; error: string };

/** Параметры с закрытым набором значений; адреса города, застройщика и отделки — любые слова. */
const FEED_FILTER_KEYS: ReadonlySet<string> = new Set(["komnat", "ot", "do", "srok", "oplata", "sort"]);

/**
 * «komnat 2, do 45000» — фильтр каталога из адреса события: только параметры, которые сайт
 * понимает сам (filterFromSearch), и только с закрытым набором значений — чужой текст (в том
 * числе «город» вида zvonite-90-123-45-67) в ленту кабинета не попадает.
 */
export function filterDetail(path: string | null | undefined): string | null {
  const query = path?.split("?")[1];
  if (!query) return null;
  const search = searchFromFilter(filterFromSearch(Object.fromEntries(new URLSearchParams(query))));
  const text = [...new URLSearchParams(search)].filter(([key]) => FEED_FILTER_KEYS.has(key)).map(([key, value]) => `${key} ${value}`).join(", ");
  return text || null;
}

/** Чужая метка — подпись «Метка рекламы» ставит SiteNowPanel по этому значению (в адресе его не написать). */
export const OTHER_SOURCE = "\u0000other";

/** Метки utm_source, которые реклама и соцсети ставят сами. */
const KNOWN_SOURCES: ReadonlySet<string> = new Set([
  "instagram", "facebook", "fb", "ig", "telegram", "tg", "google", "yandex", "youtube", "tiktok", "olx", "email", "sms",
]);
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;

/**
 * Источник в ленте: домен, откуда пришли, или известная метка — как есть; любая другая метка (её
 * пишет кто угодно в адресе ссылки) — «Метка рекламы», а не чужой текст в кабинете.
 */
export function feedSource(source: string | null | undefined): string | null {
  if (!source) return null;
  return DOMAIN.test(source) || KNOWN_SOURCES.has(source.toLowerCase()) ? source : OTHER_SOURCE;
}

export function siteNowFrom(raw: unknown): SiteNow {
  const value = (raw ?? {}) as Partial<SiteNow>;
  const feed = Array.isArray(value.feed) ? value.feed : [];
  return {
    online: Number(value.online ?? 0),
    feed: feed.map((item) => ({
      ...item,
      source: feedSource(item.source),
      ...(item.type === "filter" ? { detail: filterDetail(item.path) } : {}),
    })),
  };
}
