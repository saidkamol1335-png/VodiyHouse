import { readText } from "../credentials";
import { parsePriceInput, PRICE_MAX } from "@/lib/format";
import type { Currency } from "./blocks";

// Вкладка «Планировки» (И5): планировки выбранного блока — строки Д5. Форма шлёт список блока
// одним JSON в поле `layouts`; порядок на сайте — по комнатам и площади (как layout_availability),
// поэтому ручки порядка нет. Пределы — как check в миграции layouts (тест сверяет).

export const LAYOUT_LIMITS = {
  maxRows: 60,
  roomsMax: 10,
  areaMax: 999.99,
  priceMax: PRICE_MAX,
} as const;

/** Комнаты чипами (И5): студия и 1–6; больше — редкость, остаётся у уже сохранённых. */
export const ROOM_CHOICES = [0, 1, 2, 3, 4, 5, 6] as const;

/** У блока со списком квартир «цена от» и «доступна» считаются из квартир (PLAN §3.1). */
export type LayoutOffer = { freeCount: number | null; priceFrom: number | null };

export type LayoutDraft = {
  key: string;
  id: string | null;
  rooms: number | null;
  area: string;
  drawingId: string | null;
  drawingSrc: string | null;
  priceFrom: string;
  /** Только чтение: «доступна / нет в наличии» меняют на «Квартирах» (Н7, 12.6), вкладка его не шлёт. */
  available: boolean;
  /**
   * «Цена от», как её прочитали из базы. Вкладка шлёт её, только если правили: устаревший
   * черновик не затрёт «цену от» после «Удалить список блока». Нет — строка новая, шлётся всё.
   */
  saved?: { priceFrom: string };
  /** Только чтение: квартир с этой планировкой — удалить нельзя. */
  units: number;
  offer: LayoutOffer | null;
};

export type BlockLayouts = {
  blockId: string;
  blockName: string;
  currency: Currency;
  hasUnits: boolean;
  layouts: LayoutDraft[];
};

export type LayoutRowIssue = "roomsRequired" | "areaRequired" | "outOfRange" | "notNumber";
export type LayoutRowErrors = Record<
  string,
  Partial<Record<"rooms" | "area" | "priceFrom", LayoutRowIssue>>
>;

export type LayoutPayload = {
  id?: string;
  rooms: number;
  area: number;
  drawing_id: string | null;
  /** Нет ключа — база оставляет прежнее значение (и «доступна» — её вкладка не шлёт вовсе). */
  price_from?: number | null;
};

export type LayoutsParse =
  | { ok: true; payload: LayoutPayload[] }
  | { ok: false; error: "invalid" | "tooMany" }
  | { ok: false; error: null; rowErrors: LayoutRowErrors };

export function newLayoutDraft(copy?: LayoutDraft): LayoutDraft {
  // Копия (из соседней строки или другого блока): комнаты, площадь и тот же чертёж, цена — заново.
  return {
    key: crypto.randomUUID(),
    id: null,
    rooms: copy?.rooms ?? null,
    area: copy?.area ?? "",
    drawingId: copy?.drawingId ?? null,
    drawingSrc: copy?.drawingSrc ?? null,
    priceFrom: "",
    available: true,
    units: 0,
    offer: null,
  };
}

/** Строки по комнатам и площади — как на сайте; новые (без id) — в конце, пока не сохранены. */
export function sortLayouts(rows: readonly LayoutDraft[]): LayoutDraft[] {
  const area = (row: LayoutDraft) => Number(row.area.replace(",", ".")) || 0;
  return [...rows].sort((a, b) => (a.rooms ?? 99) - (b.rooms ?? 99) || area(a) - area(b));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEY = /^[\w-]{1,64}$/;
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

type Parsed = { value: number | null; issue?: LayoutRowIssue };

function decimal(raw: string, max: number): Parsed {
  if (!raw) return { value: null };
  const value = Number(raw.replace(/\s+/g, "").replace(",", "."));
  if (!Number.isFinite(value)) return { value: null, issue: "notNumber" };
  return value <= 0 || value > max ? { value: null, issue: "outOfRange" } : { value };
}

function savedOf(value: unknown): LayoutDraft["saved"] {
  if (typeof value !== "object" || value === null) return undefined;
  const { priceFrom } = value as Record<string, unknown>;
  return typeof priceFrom === "string" ? { priceFrom: priceFrom.trim() } : undefined;
}

function payloadOf(
  row: Record<string, unknown>,
): { payload: LayoutPayload } | { issues: LayoutRowErrors[string] } | null {
  const id = row.id === null || row.id === undefined ? null : text(row.id);
  const drawingId =
    row.drawingId === null || row.drawingId === undefined ? null : text(row.drawingId);
  if (!KEY.test(text(row.key)) || (id && !UUID.test(id)) || (drawingId && !UUID.test(drawingId)))
    return null;
  const rooms = typeof row.rooms === "number" ? row.rooms : null;
  const area = decimal(text(row.area), LAYOUT_LIMITS.areaMax);
  const price = parsePriceInput(text(row.priceFrom));
  const issues = {
    rooms:
      rooms === null || !Number.isInteger(rooms) || rooms < 0 || rooms > LAYOUT_LIMITS.roomsMax
        ? ("roomsRequired" as const)
        : undefined,
    area: area.issue ?? (area.value === null ? ("areaRequired" as const) : undefined),
    priceFrom: price.issue,
  };
  const found = Object.fromEntries(Object.entries(issues).filter(([, issue]) => issue));
  if (Object.keys(found).length > 0) return { issues: found };
  const saved = savedOf(row.saved);
  return {
    payload: {
      ...(id ? { id } : {}),
      rooms: rooms!,
      area: area.value!,
      drawing_id: drawingId || null,
      ...(!saved || text(row.priceFrom) !== saved.priceFrom ? { price_from: price.value } : {}),
    },
  };
}

/** Разбор поля `layouts`; подделанный или битый JSON — invalid. */
export function parseLayouts(formData: FormData): LayoutsParse {
  let raw: unknown;
  try {
    raw = JSON.parse(readText(formData, "layouts") ?? "");
  } catch {
    return { ok: false, error: "invalid" };
  }
  if (!Array.isArray(raw)) return { ok: false, error: "invalid" };
  if (raw.length > LAYOUT_LIMITS.maxRows) return { ok: false, error: "tooMany" };
  const rowErrors: LayoutRowErrors = {};
  const payload: LayoutPayload[] = [];
  for (const item of raw) {
    const result =
      item && typeof item === "object" ? payloadOf(item as Record<string, unknown>) : null;
    if (!result) return { ok: false, error: "invalid" };
    if ("issues" in result) rowErrors[text((item as Record<string, unknown>).key)] = result.issues;
    else payload.push(result.payload);
  }
  if (Object.keys(rowErrors).length > 0) return { ok: false, error: null, rowErrors };
  return { ok: true, payload };
}
