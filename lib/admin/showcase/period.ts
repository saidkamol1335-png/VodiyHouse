import { APP_TIME_ZONE } from "@/lib/format";
import type { ShowcaseStatus } from "./types";

// Период показа спецпредложения и рекламы (3.16а): статус по дате в Ташкенте — как
// private.tashkent_today() в базе; пересечение периодов рекламы — предупреждение кабинета (Г1 A:
// одно место на главной, показывается первая по порядку, остальные ждут).

const ISO_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** «ГГГГ-ММ-ДД» сегодняшнего дня в Ташкенте. */
export function todayInTashkent(now: Date = new Date()): string {
  return ISO_DAY.format(now);
}

export type PeriodLike = { isActive: boolean; validFrom: string | null; validTo: string | null };

/** Даты ISO сравниваются как строки. Подборка без периода: включена — на сайте. */
export function showcaseStatus(item: PeriodLike, today: string): ShowcaseStatus {
  if (!item.isActive) return "off";
  if (!item.validFrom || !item.validTo) return "active";
  if (today < item.validFrom) return "scheduled";
  if (today > item.validTo) return "expired";
  return "active";
}

export type Period = { validFrom: string; validTo: string };

export function periodsOverlap(a: Period, b: Period): boolean {
  return a.validFrom <= b.validTo && b.validFrom <= a.validTo;
}

export type AdQueueItem = Period & { id: string; isActive: boolean; sort: number; createdAt: string };

/** Очередь рекламы: первая по порядку руководителя, при равном — раньше добавленная. */
export function byAdOrder(a: AdQueueItem, b: AdQueueItem): number {
  return a.sort - b.sort || a.createdAt.localeCompare(b.createdAt);
}

/** Включённые объявления, чей период пересекается с этим, — в порядке очереди. */
export function overlappingAds<Item extends AdQueueItem>(ad: Item, ads: readonly Item[]): Item[] {
  return ads
    .filter((other) => other.id !== ad.id && other.isActive && periodsOverlap(ad, other))
    .sort(byAdOrder);
}

/** Это объявление покажется раньше пересекающихся: оно первое в очереди на свой период. */
export function adGoesFirst<Item extends AdQueueItem>(ad: Item, ads: readonly Item[]): boolean {
  return !ad.isActive || overlappingAds(ad, ads).every((other) => byAdOrder(ad, other) < 0);
}
