import type { LocalizedText } from "@/lib/contacts";

// Текст напоминания о конце спецпредложения или рекламы (3.16б) — без SDK, чтобы проверять юнитом.

/** Запись take_showcase_reminders(): что заканчивается в ближайшие 3 дня. */
export type ShowcaseReminder = {
  kind: "special" | "ad";
  id: string;
  title: LocalizedText;
  developer: string;
  /** Последний день показа, ISO-дата. */
  valid_to: string;
};

const KIND_LABEL: Record<ShowcaseReminder["kind"], string> = { special: "Спецпредложение", ad: "Реклама" };

/** «Спецпредложение «Кухня в подарок» (Sifat) заканчивается 31.10.2026 — продлить или снять: …/admin/vitrina/…». */
export function reminderText(item: ShowcaseReminder, cabinet: string, date: (value: Date) => string): string {
  return `${KIND_LABEL[item.kind]} «${item.title.ru}» (${item.developer}) заканчивается ${date(new Date(item.valid_to))} — продлить или снять: ${cabinet}`;
}
