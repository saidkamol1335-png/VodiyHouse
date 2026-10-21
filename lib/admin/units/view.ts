// Вкладка «Квартиры» для браузера: стояки готового блока собираются из квартир на сервере, а
// сам список квартир (до 5000) в страницу не идёт — его экран читает отдельно («Решения 12.2»).

import { planFromUnits, risersFromUnits, type UnitRecord } from "@/lib/units";
import type { UnitsBlock, UnitsLayout, UnitsTabView } from "./types";

type UnitsTabData = {
  blocks: UnitsBlock[];
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  units: readonly UnitRecord[];
};

export function unitsTabView({ blocks, block, layouts, units }: UnitsTabData): UnitsTabView {
  const ready =
    block && units.length > 0
      ? {
          count: units.length,
          plan: planFromUnits(units, block.floorsTotal),
          risers: risersFromUnits(units),
        }
      : null;
  return { blocks, block, layouts, ready };
}
