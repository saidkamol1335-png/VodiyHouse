// Повторы загрузки фото отчёта (фаза E, п. 37: обрыв связи не теряет загруженное, очередь продолжает).
// Сеть и сбои сервера — повтор через 2, 5, 10, 30, 60 секунд; отказ права, вида или размера — сразу
// ошибка. «Уже есть» на тот же путь — успех: файл дошёл, а ответ потерялся.

export const RETRY_DELAYS_S = [2, 5, 10, 30, 60] as const;

export type UploadFailure = { status?: number | string; statusCode?: number | string; message?: string };

/** Код ответа хранилища; нет ответа (сеть) — 0. */
export function failureStatus(error: UploadFailure | null | undefined): number {
  const raw = error?.statusCode ?? error?.status;
  const status = Number(raw);
  return Number.isFinite(status) ? status : 0;
}

/** Файл с этим путём уже лежит — наш прошлый ответ потерялся (путь — свежий uuid). */
export function isDuplicate(error: UploadFailure | null | undefined): boolean {
  const status = failureStatus(error);
  return status === 409 || /already exists|duplicate/i.test(error?.message ?? "");
}

/** Повторять: нет ответа, таймаут, лимит запросов, сбой сервера. 400/401/403/413 — нет. */
export function isRetryable(error: UploadFailure | null | undefined): boolean {
  const status = failureStatus(error);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** Задержка перед повтором номер attempt (с нуля), мс; повторы кончились — null. */
export function nextRetryDelay(attempt: number): number | null {
  const seconds = RETRY_DELAYS_S[attempt];
  return seconds === undefined ? null : seconds * 1000;
}
