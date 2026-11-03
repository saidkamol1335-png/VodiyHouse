import type { ContentErrorCode } from "@/lib/admin/developers/errors";

// Кабинет «Видео и ход стройки» (фаза 5, мокап CabVideo; Проект-2, фаза E — PLAN §10, пп. 31–38):
// данные экранов мобилографа и руководителя, ответы действий, даты съёмки по Ташкенту.

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

export type ProgressReportStatus = "draft" | "review" | "returned" | "published";

/** Фото отчёта — уходит в save_progress_draft / submit_progress_report как есть. */
export type ProgressPhoto = { path: string; width: number; height: number; blur: string | null };

/** Фото для показа: адрес подписал сервер (incoming приватный) или публичный. */
export type ProgressPhotoView = ProgressPhoto & { id: string; url: string };

/** «Мои отчёты»: свои отчёты автора, новые сверху. */
export type MyProgressReport = {
  id: string;
  complexId: string;
  complexName: string;
  blockId: string;
  blockName: string;
  unitNumber: string | null;
  isUnit: boolean;
  shotOn: string;
  status: ProgressReportStatus;
  returnNote: string | null;
  updatedAt: string;
  photos: number;
  thumbUrl: string | null;
};

/** Черновик или возвращённый отчёт — форма открывается заполненной (?id=). */
export type ProgressEdit = {
  id: string;
  status: "draft" | "returned";
  complexId: string;
  blockId: string;
  unitId: string | null;
  shotOn: string;
  comment: { ru: string; uz: string };
  youtubeId: string | null;
  videoPath: string | null;
  videoUrl: string | null;
  photos: ProgressPhotoView[];
  returnNote: string | null;
};

/** Сохранить черновик → остаёмся в форме; «На проверку» → готово (руководителю ушло сообщение?). */
export type ProgressSaveResult =
  | { status: "saved"; id: string }
  | { status: "done"; id: string; notified: boolean }
  | { status: "error"; error: ContentErrorCode };

/** @deprecated фазы 5 — то же, что ProgressSaveResult. */
export type ProgressSubmitResult = ProgressSaveResult;

/**
 * Загрузка видео с телефона в хранилище (докачка TUS) — в приватный incoming, до 50 МБ (PLAN §10, п. 31:
 * лимит бесплатного тарифа Supabase; длинные ролики — ссылкой YouTube). Лимит — на бакете.
 */
export const PHONE_VIDEO_UPLOAD = true;

/** Подсказка лимита видео в форме, МБ (сам лимит — на бакете incoming). */
export const VIDEO_MAX_MB = Number(process.env.NEXT_PUBLIC_VIDEO_MAX_MB) || 50;

/** Окно даты съёмки (п. 33): сегодня и до 60 дней назад. */
export const SHOT_WINDOW_DAYS = 60;

/** «2026-11-03» — сегодня по Ташкенту. */
export function tashkentDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

const shiftDay = (day: string, delta: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
};

/** Поле «Дата съёмки»: min — 60 дней назад, max — сегодня (по Ташкенту), по умолчанию сегодня. */
export function shotDateBounds(now: Date): { min: string; max: string } {
  const today = tashkentDay(now);
  return { min: shiftDay(today, -SHOT_WINDOW_DAYS), max: today };
}

/** Месяц отчёта из даты съёмки: «2026-11-03» → «2026-11-01». */
export function monthOfShot(shotOn: string): string {
  return `${shotOn.slice(0, 7)}-01`;
}

/** Текущий и прошлый месяц по Ташкенту — первые числа: «2026-10-01», «2026-09-01» (матрица). */
export function reportMonths(today: Date): [string, string] {
  const [year, month] = tashkentDay(today).split("-").map(Number) as [number, number];
  const pad = (n: number) => String(n).padStart(2, "0");
  const previous = month === 1 ? `${year - 1}-12-01` : `${year}-${pad(month - 1)}-01`;
  return [`${year}-${pad(month)}-01`, previous];
}

/** «Ждут проверки · N» (мокап CabReview): отчёт мобилографа на проверке, старые сверху. */
export type ReviewItem = {
  id: string;
  complexName: string;
  blockName: string;
  unitNumber: string | null;
  month: string;
  shotOn: string;
  createdAt: string;
  author: string | null;
  photos: number;
  video: boolean;
  thumbUrl: string | null;
};

/** Ящик отчёта (мокап .drw): всё для проверки по правилу 1.2. */
export type ReportDetail = {
  id: string;
  status: ProgressReportStatus;
  authorId: string | null;
  complexName: string;
  complexSlug: string;
  blockName: string;
  unitNumber: string | null;
  isUnit: boolean;
  month: string;
  shotOn: string;
  createdAt: string;
  /** Версия для публикации: «Убрать кадр» или правка после открытия ящика — «обновите страницу». */
  updatedAt: string;
  author: string | null;
  comment: { ru: string; uz: string };
  youtubeId: string | null;
  videoPath: string | null;
  videoUrl: string | null;
  photos: ProgressPhotoView[];
  returnNote: string | null;
};

/** «Привязать Telegram» мобилографа (п. 36): ссылка t.me, отвязан или ошибка. */
export type TelegramLinkResult =
  | { status: "link"; url: string }
  | { status: "unlinked" }
  | { status: "error"; error: ContentErrorCode | "telegramNoBot" };

/** Ответ «Опубликовать», «Вернуть», «Убрать кадр». */
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
  /** Адрес на сайте: видео квартиры — /video/<id>, отчёт блока — раздел «Ход строительства» ЖК. */
  url: string;
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

// ─── «Задания» (п. 34) ─────────────────────────────────────────────────────────────────

export type TaskStatus = "none" | "draft" | "review" | "returned" | "published";

export type TaskBlock = {
  id: string;
  name: string;
  status: TaskStatus;
  /** Только у своего отчёта — «Продолжить» / «Исправить». */
  reportId: string | null;
  mine: boolean;
  shotOn: string | null;
};

export type TaskComplex = { id: string; name: string; total: number; left: number; blocks: TaskBlock[] };

export type ProgressTasks = { month: string; today: string; total: number; left: number; complexes: TaskComplex[] };

// ─── «Медиа ЖК» (п. 35) ────────────────────────────────────────────────────────────────

export type MediaComplexItem = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  building: boolean;
  reports: number;
  lastMonth: string | null;
};

export type MediaReport = {
  id: string;
  isUnit: boolean;
  block: string;
  shotOn: string;
  youtubeId: string | null;
  videoUrl: string | null;
  photos: { url: string; width: number; height: number }[];
};

export type MediaComplex = {
  id: string;
  name: string;
  address: string | null;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  months: { month: string; reports: MediaReport[] }[];
};
