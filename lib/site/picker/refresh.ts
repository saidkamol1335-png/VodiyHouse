// Как часто «Выбрать квартиру» перечитывает статусы (ответ заказчика 29.10): по числу посетителей
// онлайн — меньше 10 — раз в минуту, от 10 до 50 — раз в 30 с, больше 50 — раз в 15 с. Онлайн неизвестен
// (база не ответила, нет ключа сервера) — средняя частота.

export const PICKER_REFRESH = { quiet: 60_000, usual: 30_000, busy: 15_000 } as const;

export function pickerRefreshMs(online: number | null): number {
  if (online === null) return PICKER_REFRESH.usual;
  if (online < 10) return PICKER_REFRESH.quiet;
  return online > 50 ? PICKER_REFRESH.busy : PICKER_REFRESH.usual;
}
