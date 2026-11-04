import type { CatalogPhoto } from "@/lib/site/catalog/records";
import type { ProgressReport } from "./records";

/** Папок месяцев — до 6 (как чипов раньше: 5 на 1440, шестая — прокруткой). */
const MONTHS_LIMIT = 6;
/** Листов, выглядывающих из папки. */
const PEEK_LIMIT = 3;

export type ProgressMonth = {
  /** «2026-10-01». */
  month: string;
  /** Отчёты месяца в порядке базы (новые сверху; два блока — два отчёта). */
  reports: ProgressReport[];
  photos: number;
  videos: number;
  /** Фото для листов папки: первые кадры отчётов месяца, до трёх. */
  peek: CatalogPhoto[];
};

/**
 * Отчёты → папки месяцев (03.11.2026, «Ход строительства» папками): одна папка на месяц со всеми его
 * отчётами, фото и видео. Порядок — как у базы, самый новый месяц первым.
 */
export function progressMonthsFrom(reports: readonly ProgressReport[]): ProgressMonth[] {
  const months: ProgressMonth[] = [];
  for (const report of reports) {
    let month = months.find((item) => item.month === report.month);
    if (!month) {
      if (months.length === MONTHS_LIMIT) continue;
      month = { month: report.month, reports: [], photos: 0, videos: 0, peek: [] };
      months.push(month);
    }
    month.reports.push(report);
    month.photos += report.photos.length;
    if (report.youtubeId || report.videoPath) month.videos += 1;
  }
  for (const month of months) {
    const all = month.reports.flatMap((report) => report.photos);
    // Сначала первый кадр каждого отчёта (оба блока видны), потом остальные.
    const firsts = month.reports.map((report) => report.photos[0]).filter(Boolean) as CatalogPhoto[];
    month.peek = [...new Set([...firsts, ...all])].slice(0, PEEK_LIMIT);
  }
  return months;
}
