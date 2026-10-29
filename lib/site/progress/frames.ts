import type { CatalogPhoto } from "@/lib/site/catalog/records";

// Кадры стройки (5C.3): ответ site_progress_frames() — последний опубликованный отчёт блока каждого
// ЖК на сайте и его первые 4 фото — для второго кадра карточки каталога и плитки «Видео стройки».

export type ProgressFrameRecord = {
  complex_id: string;
  report_id: string;
  month: string;
  published_at: string;
  block: string;
  photos: { path: string; width: number; height: number; blur: string | null }[];
};

export type ProgressFrame = {
  complexId: string;
  reportId: string;
  /** Первое число месяца отчёта, ISO-дата. */
  month: string;
  block: string;
  photos: CatalogPhoto[];
};

const CENTER = { x: 0.5, y: 0.5 };

/** Новые сверху (как отдаёт база); отчёт без фото не нужен ни карточке, ни главной. */
export function progressFramesFrom(
  records: readonly ProgressFrameRecord[] | null,
): ProgressFrame[] {
  return (records ?? [])
    .filter((record) => record.photos.length > 0)
    .map((record) => ({
      complexId: record.complex_id,
      reportId: record.report_id,
      month: record.month,
      block: record.block,
      photos: record.photos.map((photo) => ({ ...photo, focus: CENTER, alt: null })),
    }));
}

/** Второй кадр карточки ЖК: первое фото последнего отчёта и месяц для подписи «Стройка · Октябрь». */
export type CatalogProgress = { month: string; photo: CatalogPhoto };

export function catalogProgressOf(frame: ProgressFrame | undefined): CatalogProgress | null {
  const photo = frame?.photos[0];
  // Без размытого превью: каталог уходит в браузер целиком (как фото ЖК после второго).
  return frame && photo ? { month: frame.month, photo: { ...photo, blur: null } } : null;
}
