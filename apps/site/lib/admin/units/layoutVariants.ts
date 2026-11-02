// Две планировки блока с теми же комнатами и площадью («Дублировать», зеркальная) в списках
// выбора и строках неразличимы: стояку или квартире назначили бы не ту, а на сайте поменялись бы
// чертёж и «осталось N». Двойникам — «вариант N»; номер — по id, а не по порядку экрана: на
// «Планировках» и «Квартирах» порядок разный, а вариант должен совпадать.

/** Площадь — числом («Квартиры») или текстом черновика («Планировки»): сравнивается внутри экрана. */
type LayoutKey = { id: string; rooms: number | null; area: number | string };

/** id → номер варианта у двойников; у единственной в своём роде записи нет. */
export function layoutVariants(layouts: readonly LayoutKey[]): ReadonlyMap<string, number> {
  const groups = new Map<string, string[]>();
  for (const layout of layouts) {
    const key = `${layout.rooms}|${layout.area}`;
    groups.set(key, [...(groups.get(key) ?? []), layout.id]);
  }
  const variants = new Map<string, number>();
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    [...ids].sort().forEach((id, index) => variants.set(id, index + 1));
  }
  return variants;
}
