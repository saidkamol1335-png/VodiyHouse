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
