import type { CalcLocale, CalcT } from "@/components/PaymentCalculator/calcText";
import type { SelectOption } from "@/components/SelectField";
import type { CalcBlock, CalcStock } from "@/lib/calc/priceSource";
import { formatPrice } from "@/lib/format";

// Списки «Квартира» и «Планировка» (решение экранов «Режим „Квартира“», Р8): по группам «ЖК,
// блок»; без цены — видна, но не выбирается («цена по запросу»).

const AREA = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

function blockGroup(block: CalcBlock | undefined, t: CalcT, locale: CalcLocale) {
  return block
    ? t("price.unitGroup", { complex: block.complexName[locale], block: block.name })
    : "";
}

export function unitOptions(stock: CalcStock, t: CalcT, locale: CalcLocale): SelectOption[] {
  return stock.units.map((unit) => {
    const block = stock.blocks.find((item) => item.id === unit.blockId);
    const base = { number: unit.number, floor: unit.floor };
    const label =
      unit.price === null || unit.price <= 0
        ? t("price.unitNoPrice", base)
        : t("price.unitOption", {
            ...base,
            rooms: unit.rooms === null ? "—" : t("price.rooms", { count: unit.rooms }),
            area: unit.area === null ? "—" : AREA.format(unit.area),
            price: formatPrice(unit.price, block?.currency ?? "USD", locale),
          });
    return {
      value: unit.id,
      label,
      group: blockGroup(block, t, locale),
      disabled: unit.price === null || unit.price <= 0,
    };
  });
}

export function layoutOptions(stock: CalcStock, t: CalcT, locale: CalcLocale): SelectOption[] {
  return stock.layouts.map((layout) => {
    const block = stock.blocks.find((item) => item.id === layout.blockId);
    const base = {
      rooms: t("price.rooms", { count: layout.rooms }),
      area: AREA.format(layout.area),
    };
    const priced = layout.available && layout.priceFrom !== null && layout.priceFrom > 0;
    return {
      value: layout.id,
      label: priced
        ? t("price.layoutOption", {
            ...base,
            price: formatPrice(layout.priceFrom!, block?.currency ?? "USD", locale),
          })
        : t("price.layoutNoPrice", base),
      group: blockGroup(block, t, locale),
      disabled: !priced,
    };
  });
}
