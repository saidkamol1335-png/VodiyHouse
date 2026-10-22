import type { UnitRecord } from "@/lib/units";
import type { ReadyBlockView } from "./types";
import { readyBlockView } from "./view";

// Стояки готового блока пересобираются, только если поменялось то, из чего они собраны: места
// квартир, их планировки и этажность. Цена, статус и отделка их не трогают — иначе после каждого
// тапа «Стояки» теряли бы сохранённые правки (снимок сравнивается по ссылке) и пересчитывали 5000
// строк. Кэш живёт в useState и вызывается из рендера — как useMemo по содержимому.

const structureKey = (units: readonly UnitRecord[], floorsTotal: number | null) =>
  `${floorsTotal}|${units.map((unit) => `${unit.id}:${unit.entrance}:${unit.floor}:${unit.position}:${unit.layoutId}`).join(",")}`;

export class ReadyCache {
  private units: readonly UnitRecord[] | null = null;
  private floorsTotal: number | null = null;
  private key = "";
  private value: ReadyBlockView | null = null;

  get(units: readonly UnitRecord[], floorsTotal: number | null): ReadyBlockView | null {
    if (units === this.units && floorsTotal === this.floorsTotal) return this.value;
    this.units = units;
    this.floorsTotal = floorsTotal;
    const key = structureKey(units, floorsTotal);
    if (key !== this.key) {
      this.key = key;
      this.value = readyBlockView(units, floorsTotal);
    }
    return this.value;
  }
}
