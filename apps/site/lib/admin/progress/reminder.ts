import { LATE_DAYS } from "./matrix";

// Текст напоминания о ЖК с устаревшим ходом строительства (5D.3) — без SDK, чтобы проверять юнитом.

/** Запись progress_reminders_due(): ЖК и дата последнего опубликованного отчёта блока (нет — null). */
export type ProgressReminder = { id: string; name: string; last_published_at: string | null };

/**
 * «Ход строительства: у 2 ЖК последний отчёт старше 45 дней — …» и строка на ЖК: «• Namuna — последний
 * 02.08.2026» или «• Orzu — отчётов ещё нет»; в конце — раздел кабинета.
 */
export function progressReminderText(
  items: readonly ProgressReminder[],
  cabinet: string,
  date: (value: Date) => string,
): string {
  const lines = items.map((item) =>
    item.last_published_at
      ? `• ${item.name} — последний ${date(new Date(item.last_published_at))}`
      : `• ${item.name} — отчётов ещё нет`,
  );
  return [
    `Ход строительства: у ${items.length} ЖК последний отчёт старше ${LATE_DAYS} дней — устаревший ход строительства вредит доверию.`,
    ...lines,
    `Отчёты по ЖК: ${cabinet}`,
  ].join("\n");
}
