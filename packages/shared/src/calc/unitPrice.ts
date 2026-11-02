// Цена квартиры (Н3): хранится одна из двух — целиком или за м²; вторая считается от площади
// планировки, как в базе (coalesce(price, price_per_m2 * area)). Без округления: округляет только
// вывод (lib/format, PLAN §0.10). Расчёт рассрочки и банков — фаза 2.

export type UnitPriceSource = { price: number | null; pricePerM2: number | null };

/** Цена квартиры целиком; null — «цена по запросу» (нет цены или нет площади при цене за м²). */
export function unitTotalPrice(unit: UnitPriceSource, area: number | null): number | null {
  if (unit.price !== null) return unit.price;
  if (unit.pricePerM2 === null || area === null) return null;
  // В копейках, как numeric базы: 325 × 16,58 в float даёт 5388,4999… и вывод теряет доллар.
  return (Math.round(unit.pricePerM2 * 100) * Math.round(area * 100)) / 10_000;
}

/** Цена за м² для строки «$37 200 · $620/м²»; null — не посчитать. */
export function unitPricePerM2(unit: UnitPriceSource, area: number | null): number | null {
  if (unit.pricePerM2 !== null) return unit.pricePerM2;
  if (unit.price === null || area === null || area <= 0) return null;
  return unit.price / area;
}
