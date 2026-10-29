import type { LocalizedText } from "@/lib/contacts";
import type { Device } from "@/lib/events/types";
import type { LeadType } from "@/lib/leads/types";

// Ответ site_stats(с, по) (фаза 6, миграции 20261029190000 и 20261029200000): считает база, экран
// «Статистика сайта» только подписывает. Дни — «ГГГГ-ММ-ДД» по Ташкенту.

export type StatsTotals = {
  visitors: number;
  visits: number;
  views: number;
  /** Посетители, нажавшие «Показать телефон» или Telegram. */
  contacts: number;
  /** Посетители, открывшие страницу ЖК. */
  complex_visitors: number;
  /** Посетители, у которых «Планировки» ЖК были на экране. */
  layout_visitors: number;
  leads: number;
};

export type StatsMetric = "visitors" | "visits" | "views" | "leads";
/** Значения точки: метрики графика и «Показали телефон / Telegram» (для CSV). */
export type StatsPointValues = Record<StatsMetric | "contacts", number>;

/** Точка графика: день (или час дня, если период — один день); cur null — час ещё не наступил. */
export type StatsPoint = {
  day: string;
  hour: number;
  cur: StatsPointValues | null;
  prev: StatsPointValues;
};

export type StatsObject = { id: string; slug: string; views: number; leads: number };

export type SiteStats = {
  from: string;
  to: string;
  /** До какого момента посчитан период (сегодня — «сейчас»). */
  until: string;
  hourly: boolean;
  prev_from: string;
  prev_to: string;
  totals: StatsTotals;
  prev: StatsTotals;
  prev_has_data: boolean;
  series: StatsPoint[];
  lead_types: { type: LeadType; leads: number }[];
  sources: { source: string | null; visitors: number }[];
  devices: { device: Device; visitors: number }[];
  langs: { lang: "ru" | "uz"; visitors: number }[];
  creatives: {
    content: string;
    source: string | null;
    medium: string | null;
    visitors: number;
    leads: number;
  }[];
  complexes: (StatsObject & { name: LocalizedText })[];
  developers: (StatsObject & { name: string })[];
};
