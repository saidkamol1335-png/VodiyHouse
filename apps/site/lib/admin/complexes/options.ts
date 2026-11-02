import type { SelectOption } from "@/components/SelectField";
import type { DictionaryItem } from "../dictionaries/definitions";

// Списки выбора вкладки «Основное»: города и районы — группами (19 значений, ТЗ 1.4); скрытое в
// справочнике значение остаётся в списке, только если оно уже стоит у этого ЖК.

export function locationOptions(
  items: readonly DictionaryItem[],
  currentId: number | null,
  groups: { city: string; district: string },
): SelectOption[] {
  return items
    .filter((item) => item.isActive || item.id === currentId)
    .sort((a, b) => (a.kind === b.kind ? a.sort - b.sort : a.kind === "city" ? -1 : 1))
    .map((item) => ({
      value: String(item.id),
      label: item.name.ru,
      group: item.kind === "district" ? groups.district : groups.city,
    }));
}
