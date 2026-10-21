import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseUnitRecords, type UnitRecord } from "@/lib/units";
import type { UnitsBlock, UnitsFinishing, UnitsLayout } from "../units/types";
import { readDictionary } from "./developers";

// Вкладка «Квартиры» (шаг 12) сессией сотрудника: блоки ЖК, планировки и квартиры выбранного
// блока, отделки. Квартиры — block_unit_rows одним значением: обычный select PostgREST молча
// обрезается на 1000 строках, а в блоке до 5000 квартир. Ошибка — исключение (error.tsx).

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export type UnitsTab = {
  blocks: UnitsBlock[];
  /** null — у ЖК нет блоков. */
  block: UnitsBlock | null;
  layouts: UnitsLayout[];
  units: UnitRecord[];
  finishings: UnitsFinishing[];
};

type BlockRow = {
  id: string;
  name: string;
  floors_total: number | null;
  finishing_id: number | null;
  currency: string;
  units: { count: number }[];
};

type LayoutRow = {
  id: string;
  rooms: number;
  area: number | string;
  available: boolean;
  price_from: number | string | null;
};

const blockOf = (row: BlockRow): UnitsBlock => ({
  id: row.id,
  name: row.name,
  floorsTotal: row.floors_total,
  finishingId: row.finishing_id,
  currency: row.currency === "UZS" ? "UZS" : "USD",
  unitCount: row.units[0]?.count ?? 0,
});

/** Квартиры блока по порядку номеров; чужой или несуществующий блок — пусто. */
export async function readBlockUnits(
  supabase: SupabaseClient,
  blockId: string,
): Promise<UnitRecord[]> {
  const { data, error } = await supabase.rpc("block_unit_rows", { p_block: blockId });
  if (error) unavailable("block-units", error);
  return parseUnitRecords(data ?? []);
}

async function readLayouts(supabase: SupabaseClient, blockId: string): Promise<UnitsLayout[]> {
  const { data, error } = await supabase
    .from("layouts")
    .select("id, rooms, area, available, price_from")
    .eq("block_id", blockId)
    .order("sort");
  if (error) unavailable("units-layouts", error);
  return ((data ?? []) as LayoutRow[]).map((row) => ({
    id: row.id,
    rooms: row.rooms,
    area: Number(row.area),
    available: row.available,
    priceFrom: row.price_from === null ? null : Number(row.price_from),
  }));
}

/** blockId — из адреса (?blok=); не блок этого ЖК — первый блок. */
export async function readUnitsTab(
  supabase: SupabaseClient,
  complexId: string,
  blockId: string | null,
): Promise<UnitsTab> {
  const [blocks, finishings] = await Promise.all([
    supabase
      .from("blocks")
      .select("id, name, floors_total, finishing_id, currency, units(count)")
      .eq("complex_id", complexId)
      .order("sort")
      .order("name"),
    readDictionary(supabase, "finishings"),
  ]);
  if (blocks.error) unavailable("units-blocks", blocks.error);
  const all = ((blocks.data ?? []) as unknown as BlockRow[]).map(blockOf);
  const block = all.find((item) => item.id === blockId) ?? all[0] ?? null;
  const [layouts, units] = block
    ? await Promise.all([readLayouts(supabase, block.id), readBlockUnits(supabase, block.id)])
    : [[], []];
  return {
    blocks: all,
    block,
    layouts,
    units,
    finishings: finishings.map((item) => ({
      id: item.id,
      name: item.name.ru,
      isActive: item.isActive,
    })),
  };
}
