import { paymentFrom } from "@/lib/calc/compare";
import type { Currency } from "@/lib/calc/money";
import { blockPrograms } from "./blocks";
import type { ComplexLayout, ComplexPage } from "./model";

// «Планировки» (мокап .plans, ТЗ 7.4): карточки планировок с чертежом — без чертежа планировка на
// сайте не показывается, её тип остаётся в «Наличии» (решение шага 11). Фильтры — по блоку (если их
// несколько) и комнатам; «Платёж от» — как у карточки ЖК: lib/calc paymentFrom, без скидок.

/** «Мало осталось» — янтарная плашка, как у карточки каталога (3 и меньше). */
export const FEW_LEFT = 3;

export type LayoutLeft = { kind: "left"; count: number; few: boolean } | { kind: "inStock" } | { kind: "none" };

export type LayoutCard = {
  layout: ComplexLayout;
  blockName: string;
  currency: Currency;
  left: LayoutLeft;
  /** Цена «от» и за м²; нет цены или нет в наличии — «Узнать цену». */
  price: { amount: number; perM2: number } | null;
  payment: number | null;
  /** Расчёт открывается у доступной планировки с ценой (site_layout_calc). */
  calculable: boolean;
};

export type LayoutFilter = { blockId: string | null; rooms: number | null };

function leftOf(layout: ComplexLayout): LayoutLeft {
  if (!layout.available) return { kind: "none" };
  if (layout.free === null) return { kind: "inStock" };
  return { kind: "left", count: layout.free, few: layout.free <= FEW_LEFT };
}

export function layoutCards(page: ComplexPage): LayoutCard[] {
  return page.layouts.flatMap((layout) => {
    const block = page.blocks.find((item) => item.id === layout.blockId);
    if (!block || !layout.drawing) return [];
    const priced = layout.available && layout.priceFrom !== null && layout.priceFrom > 0 ? layout.priceFrom : null;
    const programs = blockPrograms(page, block.id).map((entry) => entry.program);
    return [
      {
        layout,
        blockName: block.name,
        currency: block.currency,
        left: leftOf(layout),
        price: priced === null ? null : { amount: priced, perM2: priced / layout.area },
        payment: priced === null ? null : paymentFrom(programs, priced, block.currency, page.catalog.rate),
        calculable: priced !== null,
      },
    ];
  });
}

export function filterLayouts(cards: readonly LayoutCard[], filter: LayoutFilter): LayoutCard[] {
  return cards.filter(
    (card) => (filter.blockId === null || card.layout.blockId === filter.blockId) && (filter.rooms === null || card.layout.rooms === filter.rooms),
  );
}

/** Варианты фильтров: блоки — только при нескольких, комнаты — какие есть у выбранного блока. */
export function layoutFilterOptions(cards: readonly LayoutCard[], blockId: string | null) {
  const blocks = [...new Map(cards.map((card) => [card.layout.blockId, card.blockName])).entries()].map(([id, name]) => ({ id, name }));
  const rooms = [...new Set(cards.filter((card) => blockId === null || card.layout.blockId === blockId).map((card) => card.layout.rooms))].sort(
    (a, b) => a - b,
  );
  return { blocks: blocks.length > 1 ? blocks : [], rooms: rooms.length > 1 ? rooms : [] };
}
