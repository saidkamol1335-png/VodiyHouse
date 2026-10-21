import { MEDIA_LIMITS } from "@/lib/media";
import type { ComplexTabKey } from "./tabs";

// Готовность ЖК к публикации (PLAN 3а, И7, И9): те же 8 пунктов и цифры, что считает база
// (private.complex_requirements, тест сверяет), — строка «Для публикации: N из 8» и точки на вкладках.

export const COMPLEX_REQUIREMENTS = [
  "address",
  "location",
  "point",
  "developer",
  "blocks",
  "layouts",
  "photos",
  "cover",
] as const;

export type ComplexRequirement = (typeof COMPLEX_REQUIREMENTS)[number];

/** И7: 5 фото вместе с обложкой; обложка — первое фото, от 2400 px. */
export const PUBLISH_RULES = {
  minPhotos: 5,
  coverMinLongSide: MEDIA_LIMITS.complexCoverMinLongSide,
} as const;

export const REQUIREMENT_TAB: Record<ComplexRequirement, ComplexTabKey> = {
  address: "main",
  location: "main",
  point: "main",
  developer: "main",
  blocks: "blocks",
  layouts: "layouts",
  photos: "photos",
  cover: "photos",
};

/** have — сколько фото уже есть (только у photos): «нужно ещё N». */
export type ReadinessItem = { requirement: ComplexRequirement; ok: boolean; have: number | null };

export type ReadinessRecord = { requirement: string; ok: boolean; have: number | null };

const isRequirement = (value: string): value is ComplexRequirement =>
  (COMPLEX_REQUIREMENTS as readonly string[]).includes(value);

export function parseReadiness(records: readonly ReadinessRecord[]): ReadinessItem[] {
  const byKey = new Map(
    records
      .filter((record) => isRequirement(record.requirement))
      .map((record) => [record.requirement, record]),
  );
  return COMPLEX_REQUIREMENTS.filter((key) => byKey.has(key)).map((key) => ({
    requirement: key,
    ok: byKey.get(key)!.ok,
    have: byKey.get(key)!.have,
  }));
}

export const missingOf = (items: readonly ReadinessItem[]): ComplexRequirement[] =>
  items.filter((item) => !item.ok).map((item) => item.requirement);

export function tabsNeedingAttention(items: readonly ReadinessItem[]): Set<ComplexTabKey> {
  return new Set(missingOf(items).map((requirement) => REQUIREMENT_TAB[requirement]));
}

/** Сколько фото не хватает до публикации. */
export function photosShort(items: readonly ReadinessItem[]): number {
  const photos = items.find((item) => item.requirement === "photos");
  return Math.max(0, PUBLISH_RULES.minPhotos - (photos?.have ?? 0));
}

/** Отказ базы vh:not_ready несёт пункты в detail: «photos,cover». */
export function requirementsFromDetail(detail: string | null | undefined): ComplexRequirement[] {
  return (detail ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(isRequirement);
}
