import { MEDIA_LIMITS } from "@/lib/media";
import type { ComplexTabKey } from "./tabs";

// Минимум ЖК (docs/publication-rule.md): те же 6 пунктов и цифры, что считает база
// (private.complex_requirements, тест сверяет), — строка «Для публикации: N из 6» и точки на вкладках.

export const COMPLEX_REQUIREMENTS = [
  "address",
  "point",
  "developer",
  "renders",
  "blocks",
  "payment",
] as const;

export type ComplexRequirement = (typeof COMPLEX_REQUIREMENTS)[number];

/** Обложка — первое фото, от 2400 px; ещё минимум 4 общих рендера. Рендеры квартир не считаются. */
export const PUBLISH_RULES = {
  minOtherRenders: 4,
  coverMinLongSide: MEDIA_LIMITS.complexCoverMinLongSide,
} as const;

// Застройщик выбирают на «Основном», программу и курс ведут в «Программах оплаты» (ссылка — блок C).
export const REQUIREMENT_TAB: Record<ComplexRequirement, ComplexTabKey> = {
  address: "main",
  point: "main",
  developer: "main",
  renders: "photos",
  blocks: "blocks",
  payment: "main",
};

/** have — сколько общих рендеров есть, кроме обложки (только у renders): «нужно ещё N». */
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

/** Сколько общих рендеров не хватает до публикации, кроме обложки. */
export function rendersShort(items: readonly ReadinessItem[]): number {
  const renders = items.find((item) => item.requirement === "renders");
  return Math.max(0, PUBLISH_RULES.minOtherRenders - (renders?.have ?? 0));
}

/** Отказ базы vh:not_ready несёт пункты в detail: «renders,payment». */
export function requirementsFromDetail(detail: string | null | undefined): ComplexRequirement[] {
  return (detail ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(isRequirement);
}
