import type { ContentErrorCode } from "@/lib/admin/developers/errors";

// Кабинет «Видео и ход стройки» (фаза 5, мокап CabVideo): данные экрана видеографа и ответы действий.

/** ЖК для «Нового отчёта»: только с хотя бы одним строящимся блоком (мокап — не сданные ЖК). */
export type ProgressFormComplex = {
  id: string;
  name: string;
  blocks: { id: string; name: string }[];
};

/** Квартира в «Квартира · необязательно»: проданных нет (видео для клиента им не нужно). */
export type ProgressUnitOption = {
  id: string;
  number: string;
  floor: number;
  status: "free" | "reserved";
  rooms: number | null;
  area: number | null;
};

export type ProgressReportStatus = "review" | "returned" | "published";

/** «Мои отчёты» (мокап CabVideo, справа): последние свои отчёты. */
export type MyProgressReport = {
  id: string;
  complexId: string;
  complexName: string;
  blockId: string;
  blockName: string;
  unitNumber: string | null;
  isUnit: boolean;
  month: string;
  status: ProgressReportStatus;
  returnNote: string | null;
  createdAt: string;
  thumb: string | null;
};

/** Загруженное фото отчёта — уходит в submit_progress_report как есть. */
export type ProgressPhoto = { path: string; width: number; height: number; blur: string | null };

export type ProgressSubmitResult =
  { status: "done"; id: string } | { status: "error"; error: ContentErrorCode };

/** Текущий и прошлый месяц по Ташкенту — первые числа: «2026-10-01», «2026-09-01» (мокап). */
export function reportMonths(today: Date): [string, string] {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
  })
    .format(today)
    .split("-")
    .map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  const previous = month === 1 ? `${year - 1}-12-01` : `${year}-${pad(month - 1)}-01`;
  return [`${year}-${pad(month)}-01`, previous];
}

/** Возвращённый отчёт для «Исправить»: форма открывается заполненной (фаза 5, 5B.4). */
export type ProgressFix = {
  id: string;
  complexId: string;
  blockId: string;
  unitId: string | null;
  month: string;
  comment: { ru: string; uz: string };
  youtubeId: string | null;
  videoPath: string | null;
  photos: ProgressPhoto[];
  returnNote: string;
};

/** «Ждут проверки · N» (мокап CabReview): отчёт видеографа на проверке, старые сверху. */
export type ReviewItem = {
  id: string;
  complexName: string;
  blockName: string;
  unitNumber: string | null;
  month: string;
  createdAt: string;
  author: string | null;
  photos: number;
  video: boolean;
  thumb: string | null;
};

/** Ящик отчёта (мокап .drw): всё для проверки по правилу 1.2. */
export type ReportDetail = {
  id: string;
  status: ProgressReportStatus;
  complexName: string;
  complexSlug: string;
  blockName: string;
  unitNumber: string | null;
  isUnit: boolean;
  month: string;
  createdAt: string;
  author: string | null;
  comment: { ru: string; uz: string };
  youtubeId: string | null;
  videoPath: string | null;
  photos: ProgressPhoto[];
  returnNote: string | null;
};

/** Ответ «Опубликовать» и «Вернуть видеографу». */
export type ReviewActionResult = { status: "done" } | { status: "error"; error: ContentErrorCode };

/** Ячейка матрицы (мокап CabReview): опубликован (дата), на проверке, дом сдан, ждём (этот месяц), нет. */
export type MatrixCell =
  | { kind: "published"; date: string; reportId: string }
  | { kind: "review"; reportId: string }
  | { kind: "built" }
  | { kind: "wait" }
  | { kind: "none" };

export type MatrixRow = { complexId: string; name: string; late: boolean; cells: MatrixCell[] };

/** «Отчёты по ЖК · последние 6 месяцев»: месяцы слева направо, от старого к текущему. */
export type ProgressMatrix = { months: string[]; rows: MatrixRow[]; late: number };

/** «Видео для клиентов · последние»: опубликованные отчёты — ссылка клиенту и «Открыть». */
export type ClientVideo = {
  id: string;
  complexName: string;
  blockName: string;
  unitNumber: string | null;
  isUnit: boolean;
  month: string;
  shotAt: string;
  author: string | null;
  thumb: string | null;
  /** Путь на сайте: видео квартиры — /video/<id>, отчёт блока — раздел «Ход строительства» ЖК. */
  path: string;
};

/** Последние 6 месяцев до текущего по Ташкенту — первые числа, от старого к новому. */
export function matrixMonths(today: Date, count = 6): string[] {
  const [current] = reportMonths(today);
  const [year, month] = current.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, index) => {
    const shift = count - 1 - index;
    const total = year * 12 + (month - 1) - shift;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
  });
}
