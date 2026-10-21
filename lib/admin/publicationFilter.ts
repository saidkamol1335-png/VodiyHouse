import { PUBLICATION_STATUSES, type PublicationStatus } from "./publication";

// Пилюли статусов над списками «Застройщики» и «ЖК» (решения Д1 и в. 5) и поиск без апострофов.
// Записей немного (на старте 10–15), поэтому ищем и считаем в браузере, без запросов.

/** «Все» — без архива: архив — корзина на 30 дней, у него своя пилюля. */
export type PublicationFilter = "all" | PublicationStatus;
export const PUBLICATION_FILTERS: readonly PublicationFilter[] = ["all", ...PUBLICATION_STATUSES];

export function matchesPublicationFilter(
  status: PublicationStatus,
  filter: PublicationFilter,
): boolean {
  return filter === "all" ? status !== "archived" : status === filter;
}

export function countByPublicationFilter(
  statuses: readonly PublicationStatus[],
): Record<PublicationFilter, number> {
  return Object.fromEntries(
    PUBLICATION_FILTERS.map((filter) => [
      filter,
      statuses.filter((status) => matchesPublicationFilter(status, filter)).length,
    ]),
  ) as Record<PublicationFilter, number>;
}

const APOSTROPHES = /['‘’ʻʼ`´]/g;

/** Для поиска: «fargona» найдёт «Farg‘ona», регистр не важен. */
export function searchableText(text: string): string {
  return text.replace(APOSTROPHES, "").toLowerCase();
}

export const isPublicationStatus = (value: string): value is PublicationStatus =>
  (PUBLICATION_STATUSES as readonly string[]).includes(value);
