// Тексты Telegram об отчётах мобилографа (фаза E, п. 36): руководителю — «На проверку», автору —
// «Возвращён: причина» и «Опубликован». Подпись отчёта — из базы (private.progress_notice).

export type ProgressNotice = {
  complex: string | null;
  block: string | null;
  unit: string | null;
  is_unit: boolean;
  shot_on: string | null;
  author: string | null;
};

/** «2026-11-03» → «03.11.2026». */
const day = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "");

/** «ЖК Yulduz · Блок A · кв. 12 · снято 03.11.2026». */
export function noticeLine(notice: ProgressNotice): string {
  return [
    notice.complex ? `ЖК ${notice.complex}` : null,
    notice.block ? `Блок ${notice.block}` : null,
    notice.unit ? `кв. ${notice.unit}` : notice.is_unit ? "видео квартиры" : null,
    notice.shot_on ? `снято ${day(notice.shot_on)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function progressSubmittedText(notice: ProgressNotice, url: string): string {
  return [
    "📸 Новый отчёт на проверке",
    noticeLine(notice),
    notice.author ? `Снял: ${notice.author}` : null,
    "Проверьте по правилу 1.2 и опубликуйте:",
    url,
  ]
    .filter(Boolean)
    .join("\n");
}

export function progressReturnedText(notice: ProgressNotice, note: string, url: string): string {
  return ["↩️ Отчёт возвращён", noticeLine(notice), `Что исправить: ${note}`, url].join("\n");
}

export function progressPublishedText(notice: ProgressNotice, url: string): string {
  return ["✅ Отчёт опубликован", noticeLine(notice), url].join("\n");
}
