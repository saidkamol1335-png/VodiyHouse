"use client";

import { useTranslations } from "next-intl";
import type { PickerUnit } from "@/lib/site/picker/records";
import type { PickerBlockView } from "./ComplexPicker";

/** «Блок A», «Сдан» / «Строится · 58%» — те же подписи, что у карточек блоков страницы ЖК. */
export function useBlockLabels() {
  const t = useTranslations("complex.blocks");
  return {
    name: (block: PickerBlockView) => t("block", { name: block.name }),
    status: (block: PickerBlockView) =>
      block.buildStatus === "delivered"
        ? t("built")
        : block.progressPct !== null
          ? t("buildingPct", { pct: block.progressPct })
          : t("building"),
  };
}

/** Свободные по комнатам (подсказка фасада): «1-комн. — 4 шт.», комнаты по порядку. */
export function freeByRooms(units: readonly PickerUnit[]): { rooms: number; free: number }[] {
  const counts = new Map<number, number>();
  for (const unit of units) {
    if (unit.status !== "free" || unit.rooms === null) continue;
    counts.set(unit.rooms, (counts.get(unit.rooms) ?? 0) + 1);
  }
  return [...counts].sort(([a], [b]) => a - b).map(([rooms, free]) => ({ rooms, free }));
}
