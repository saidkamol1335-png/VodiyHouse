import type { LocalizedText } from "@/lib/contacts";

// «Удобство локации» (Ф5): места рядом с ЖК — вводит руководитель (вкладка «Основное», панель
// «Расположение»). Формат и пределы — как private.valid_nearby (20261025180000_complex_page.sql).

export const NEARBY_KINDS = ["school", "kindergarten", "mosque", "clinic", "shop", "cafe", "stop", "park", "sport"] as const;
export type NearbyKind = (typeof NEARBY_KINDS)[number];
export type NearbyMode = "walk" | "car";

export const NEARBY_LIMITS = {
  places: 12,
  nameMax: 60,
  metersMax: 50_000,
  minutesMax: 240,
} as const;

export type NearbyPlace = {
  kind: NearbyKind;
  name: LocalizedText;
  /** По прямой. */
  meters: number | null;
  minutes: number | null;
  /** Минуты пешком или на машине. */
  mode: NearbyMode;
};

const isKind = (value: unknown): value is NearbyKind => NEARBY_KINDS.includes(value as NearbyKind);

const wholeIn = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max ? value : null;

function placeFrom(raw: unknown): NearbyPlace | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const name = item.name as Partial<LocalizedText> | undefined;
  if (!isKind(item.kind) || typeof name?.ru !== "string" || typeof name.uz !== "string") return null;
  const meters = wholeIn(item.meters, NEARBY_LIMITS.metersMax);
  const minutes = wholeIn(item.minutes, NEARBY_LIMITS.minutesMax);
  if (meters === null && minutes === null) return null;
  return {
    kind: item.kind,
    name: { ru: name.ru, uz: name.uz },
    meters,
    minutes,
    mode: item.mode === "car" ? "car" : "walk",
  };
}

/** Значение из базы (jsonb): неверное место пропускается — сайт не покажет пустую строку. */
export function nearbyFrom(raw: unknown): NearbyPlace[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const place = placeFrom(item);
    return place ? [place] : [];
  });
}

/** Для базы: пустые поля не пишутся (null база не примет), пешком — по умолчанию. */
export function nearbyRecord(place: NearbyPlace): Record<string, unknown> {
  return {
    kind: place.kind,
    name: place.name,
    ...(place.meters !== null ? { meters: place.meters } : {}),
    ...(place.minutes !== null ? { minutes: place.minutes } : {}),
    ...(place.mode === "car" ? { mode: "car" } : {}),
  };
}
