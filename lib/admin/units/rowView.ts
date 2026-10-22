// Ячейки строки списка квартир (Н1): планировка, цена, отделка. Деньги — lib/calc и lib/format
// (CLAUDE.md §1); тексты подписей («как в блоке», «без цены») — в компоненте из messages.

import { unitPricePerM2, unitTotalPrice } from "@/lib/calc/unitPrice";
import { formatPrice, formatPricePerM2 } from "@/lib/format";
import type { RoomsByLayout, UnitRecord } from "@/lib/units";
import { layoutVariants } from "./layoutVariants";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "./types";

export type UnitRowContext = {
  layouts: ReadonlyMap<string, UnitsLayout>;
  /** Двойники по комнатам и площади — «вариант N» (layoutVariants). */
  variants: ReadonlyMap<string, number>;
  rooms: RoomsByLayout;
  finishings: ReadonlyMap<number, string>;
  blockFinishingId: number | null;
  currency: UnitsBlock["currency"];
  /**
   * Подпись содержимого: страница после каждого тапа присылает новые массивы с тем же
   * содержимым — строки сравнивают подпись, а не ссылку, и не перерисовываются все разом.
   */
  signature: string;
};

export function unitRowContext(
  block: UnitsBlock,
  layouts: readonly UnitsLayout[],
  finishings: readonly UnitsFinishing[],
): UnitRowContext {
  return {
    layouts: new Map(layouts.map((layout) => [layout.id, layout])),
    variants: layoutVariants(layouts),
    rooms: new Map(layouts.map((layout) => [layout.id, layout.rooms])),
    finishings: new Map(finishings.map((item) => [item.id, item.name])),
    blockFinishingId: block.finishingId,
    currency: block.currency,
    signature: [
      block.id,
      block.currency,
      block.finishingId,
      layouts.map((layout) => `${layout.id}:${layout.rooms}:${layout.area}`).join(","),
      finishings.map((item) => `${item.id}:${item.name}`).join(","),
    ].join("|"),
  };
}

export type UnitRowView = {
  layout: { rooms: number; area: number; variant: number | null } | null;
  /** «$37 200»; null — не посчитать (нет цены или площади). */
  total: string | null;
  /** «$620/м²»; null — не посчитать. */
  perM2: string | null;
  /** inherited — своей нет, показана отделка блока («как в блоке»); null — нет никакой. */
  finishing: { name: string; inherited: boolean } | null;
  /** Цена брони и проданной — серым: сайт её не видит («Решаю сам» шага 12). */
  muted: boolean;
};

function finishingOf(unit: UnitRecord, ctx: UnitRowContext): UnitRowView["finishing"] {
  const own = unit.finishingId === null ? undefined : ctx.finishings.get(unit.finishingId);
  if (own !== undefined) return { name: own, inherited: false };
  const block =
    ctx.blockFinishingId === null ? undefined : ctx.finishings.get(ctx.blockFinishingId);
  return block === undefined ? null : { name: block, inherited: true };
}

export function unitRowView(unit: UnitRecord, ctx: UnitRowContext): UnitRowView {
  const layout = unit.layoutId === null ? undefined : ctx.layouts.get(unit.layoutId);
  const area = layout?.area ?? null;
  const total = unitTotalPrice(unit, area);
  const perM2 = unitPricePerM2(unit, area);
  return {
    layout: layout
      ? { rooms: layout.rooms, area: layout.area, variant: ctx.variants.get(layout.id) ?? null }
      : null,
    total: total === null ? null : formatPrice(total, ctx.currency),
    perM2: perM2 === null ? null : formatPricePerM2(perM2, ctx.currency),
    finishing: finishingOf(unit, ctx),
    muted: unit.status !== "free",
  };
}
