import type { PublicationStatus } from "../publication";

// Статус застройщика (PLAN §3.11–3.12): что можно сделать из каждого статуса, чего не хватает
// для публикации (то же проверяет триггер базы — vh:not_ready) и когда архив удалится.

/** Куда можно перевести из статуса: в архив — откуда угодно, из архива — только в черновик. */
export const STATUS_MOVES: Record<PublicationStatus, readonly PublicationStatus[]> = {
  draft: ["published", "archived"],
  published: ["hidden", "archived"],
  hidden: ["published", "archived"],
  archived: ["draft"],
};

export function canMove(from: PublicationStatus, to: PublicationStatus): boolean {
  return STATUS_MOVES[from].includes(to);
}

export type PublishRequirement = "about" | "logo";

/** Чего не хватает странице застройщика на сайте (ТЗ 8.2, 8.4); пусто — можно публиковать. */
export function missingForPublish(developer: {
  hasAbout: boolean;
  hasLogo: boolean;
}): PublishRequirement[] {
  const missing: PublishRequirement[] = [];
  if (!developer.hasAbout) missing.push("about");
  if (!developer.hasLogo) missing.push("logo");
  return missing;
}

export const ARCHIVE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Когда архив удалится окончательно (pg_cron, фаза 3) — дата для «Удалится дд.мм.гггг». */
export function deletionDate(archivedAt: string): Date {
  return new Date(new Date(archivedAt).getTime() + ARCHIVE_DAYS * DAY_MS);
}

const APOSTROPHES = /['‘’ʻʼ`´]/g;
const comparable = (text: string) =>
  text.replace(APOSTROPHES, "'").replace(/\s+/g, " ").trim().toLowerCase();

/** «В архив» подтверждается вводом названия (PLAN 3а): апостроф и регистр — любые. */
export function archiveConfirmed(typed: string, name: string): boolean {
  return comparable(typed) !== "" && comparable(typed) === comparable(name);
}
