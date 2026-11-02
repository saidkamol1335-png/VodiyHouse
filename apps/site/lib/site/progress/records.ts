import type { LocalizedText } from "@/lib/contacts";
import type { CatalogPhoto } from "@/lib/site/catalog/records";

// Ход строительства (фаза 5): ответы site_complex_progress(ЖК) и site_unit_video(отчёт) как есть и
// преобразование в данные компонентов. Фото отчётов — без кадрирования: точка фокуса по центру.

type ProgressBlockRecord = {
  id: string;
  name: string;
  build_status: "building" | "delivered";
  progress_pct: number | null;
  floors_total: number | null;
  floors_built: number | null;
  deadline_year: number | null;
  deadline_quarter: number | null;
};

export type ProgressReportRecord = {
  id: string;
  is_unit: boolean;
  month: string;
  shot_at: string;
  comment: LocalizedText;
  youtube_id: string | null;
  video_path: string | null;
  block: ProgressBlockRecord | null;
  photos: { path: string; width: number; height: number; blur: string | null }[];
};

export type UnitVideoRecord = ProgressReportRecord & {
  complex: { id: string; slug: string; name: LocalizedText; developer: string | null };
  layout_id: string | null;
  rooms: number | null;
  area: number | string | null;
  floor: number | null;
  history: ProgressReportRecord[];
};

export type ProgressBlock = {
  id: string;
  name: string;
  delivered: boolean;
  progressPct: number | null;
  floorsTotal: number | null;
  floorsBuilt: number | null;
  deadline: { year: number; quarter: number } | null;
};

export type ProgressReport = {
  id: string;
  /** Отчёт по квартире (видео для клиента), а не по блоку. */
  isUnit: boolean;
  /** Первое число месяца отчёта, «2026-10-01». */
  month: string;
  /** Когда снято (загружено) — «Снято 02.10.2026». */
  shotAt: string;
  comment: LocalizedText;
  youtubeId: string | null;
  videoPath: string | null;
  block: ProgressBlock | null;
  photos: CatalogPhoto[];
};

export type UnitVideo = ProgressReport & {
  complex: { id: string; slug: string; name: LocalizedText; developer: string | null };
  layoutId: string | null;
  rooms: number | null;
  area: number | null;
  floor: number | null;
  /** Предыдущие месяцы: отчёты этой квартиры и её блока, новые сверху. */
  history: ProgressReport[];
};

const CENTER = { x: 0.5, y: 0.5 };

function blockFrom(record: ProgressBlockRecord | null): ProgressBlock | null {
  if (!record) return null;
  return {
    id: record.id,
    name: record.name,
    delivered: record.build_status === "delivered",
    progressPct: record.progress_pct,
    floorsTotal: record.floors_total,
    floorsBuilt: record.floors_built,
    deadline:
      record.deadline_year && record.deadline_quarter
        ? { year: record.deadline_year, quarter: record.deadline_quarter }
        : null,
  };
}

export function progressReportFrom(record: ProgressReportRecord): ProgressReport {
  return {
    id: record.id,
    isUnit: record.is_unit,
    month: record.month,
    shotAt: record.shot_at,
    comment: record.comment,
    youtubeId: record.youtube_id,
    videoPath: record.video_path,
    block: blockFrom(record.block),
    photos: record.photos.map((photo) => ({ ...photo, focus: CENTER, alt: null })),
  };
}

export function progressReportsFrom(
  records: readonly ProgressReportRecord[] | null,
): ProgressReport[] {
  return (records ?? []).map(progressReportFrom);
}

export function unitVideoFrom(record: UnitVideoRecord): UnitVideo {
  return {
    ...progressReportFrom(record),
    complex: record.complex,
    layoutId: record.layout_id,
    rooms: record.rooms,
    area: record.area === null ? null : Number(record.area),
    floor: record.floor,
    history: progressReportsFrom(record.history),
  };
}
