import { NEARBY_KINDS, NEARBY_LIMITS, type NearbyKind, type NearbyMode, type NearbyPlace } from "@/lib/site/complex/nearby";
import { bilingualHasContact } from "../contactGuard";

// «Удобство локации» во вкладке «Основное» (Ф5): строки как набраны (черновик) → места для базы.
// Пределы — как private.valid_nearby; одна проверка у формы и у сервера.

export type NearbyDraft = { key: string; kind: string; nameRu: string; nameUz: string; meters: string; minutes: string; mode: NearbyMode };

export type NearbyIssue = "nearbyKind" | "nearbyName" | "nearbyNameLong" | "nearbyDistance" | "nearbyRange" | "contacts";

// Ключ строки: у пришедших с сервера — по номеру (одинаково при SSR и в браузере, иначе id полей
// расходятся при гидратации), у добавленной кнопкой — случайный.
const rowKey = (index: number) => `nearby-${index}`;

export const emptyNearbyDraft = (): NearbyDraft => ({ key: crypto.randomUUID(), kind: "school", nameRu: "", nameUz: "", meters: "", minutes: "", mode: "walk" });

export function nearbyDrafts(places: readonly NearbyPlace[]): NearbyDraft[] {
  return places.map((place, index) => ({
    key: rowKey(index),
    kind: place.kind,
    nameRu: place.name.ru,
    nameUz: place.name.uz,
    meters: place.meters === null ? "" : String(place.meters),
    minutes: place.minutes === null ? "" : String(place.minutes),
    mode: place.mode,
  }));
}

const isKind = (value: string): value is NearbyKind => NEARBY_KINDS.includes(value as NearbyKind);

/** «270», «1 200» → 270, 1200; пусто — null; не целое или вне пределов — NaN. */
function wholeOrNull(raw: string, max: number): number | null {
  const text = raw.replace(/\s/g, "");
  if (!text) return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 1 && value <= max ? value : Number.NaN;
}

/** Что не так со строкой; null — можно сохранять. */
export function nearbyDraftIssue(draft: NearbyDraft): NearbyIssue | null {
  if (!isKind(draft.kind)) return "nearbyKind";
  const name = { ru: draft.nameRu.trim(), uz: draft.nameUz.trim() };
  if (!name.ru || !name.uz) return "nearbyName";
  if (name.ru.length > NEARBY_LIMITS.nameMax || name.uz.length > NEARBY_LIMITS.nameMax) return "nearbyNameLong";
  if (bilingualHasContact(name)) return "contacts";
  const meters = wholeOrNull(draft.meters, NEARBY_LIMITS.metersMax);
  const minutes = wholeOrNull(draft.minutes, NEARBY_LIMITS.minutesMax);
  if (Number.isNaN(meters) || Number.isNaN(minutes)) return "nearbyRange";
  return meters === null && minutes === null ? "nearbyDistance" : null;
}

function placeOf(draft: NearbyDraft): NearbyPlace {
  return {
    kind: draft.kind as NearbyKind,
    name: { ru: draft.nameRu.trim(), uz: draft.nameUz.trim() },
    meters: wholeOrNull(draft.meters, NEARBY_LIMITS.metersMax),
    minutes: wholeOrNull(draft.minutes, NEARBY_LIMITS.minutesMax),
    mode: draft.mode === "car" ? "car" : "walk",
  };
}

const asDraft = (raw: unknown, index: number): NearbyDraft | null => {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return { key: text(item.key) || rowKey(index), kind: text(item.kind), nameRu: text(item.nameRu), nameUz: text(item.nameUz), meters: text(item.meters), minutes: text(item.minutes), mode: item.mode === "car" ? "car" : "walk" };
};

/** Скрытое поле формы (JSON черновиков) → черновики; испорченное — как пустой список. */
export function readNearbyDrafts(raw: string | null): NearbyDraft[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(parsed) ? parsed.flatMap((item, index) => asDraft(item, index) ?? []) : [];
  } catch {
    return [];
  }
}

/** Черновики → места для базы; первая ошибка — у поля «Удобство локации» с номером строки. */
export function parseNearby(all: readonly NearbyDraft[]): { value: NearbyPlace[] | null; issue?: NearbyIssue; row?: number } {
  // Пустую строку после «Добавить место» не ругаем и не сохраняем — как пустую строку «Видео».
  const drafts = all.filter((draft) => draft.nameRu.trim() || draft.nameUz.trim() || draft.meters.trim() || draft.minutes.trim());
  if (drafts.length > NEARBY_LIMITS.places) return { value: null, issue: "nearbyRange", row: NEARBY_LIMITS.places + 1 };
  for (const [index, draft] of drafts.entries()) {
    const issue = nearbyDraftIssue(draft);
    if (issue) return { value: null, issue, row: index + 1 };
  }
  return { value: drafts.map(placeOf) };
}
