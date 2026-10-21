import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blockDraftsFrom, type BlockDraft, type BlockRecord } from "../complexes/blocks";
import { sortLayouts, type BlockLayouts } from "../complexes/layouts";
import { parseComplexRows, type ComplexListRow, type ComplexRowRecord } from "../complexes/list";
import { parseReadiness, type ReadinessItem, type ReadinessRecord } from "../complexes/readiness";
import {
  COMPLEX_COLUMNS,
  complexFrom,
  type ComplexDbRow,
  type ComplexRecord,
} from "../complexes/record";
import { stockByComplex, type RoomAvailabilityRecord } from "../complexes/stock";
import type { DeveloperOption } from "../complexes/types";

// Чтение данных кабинета ЖК сессией сотрудника (RLS). Ошибка сети или базы — исключение:
// app/admin/error.tsx покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

/** Строки списка «ЖК» с остатками по комнатам (два запроса на весь список). */
export async function readComplexRows(supabase: SupabaseClient): Promise<ComplexListRow[]> {
  const rows = await supabase.rpc("complex_rows");
  if (rows.error) unavailable("complex-rows", rows.error);
  const records = (rows.data ?? []) as ComplexRowRecord[];
  if (records.length === 0) return [];
  const stock = await supabase.rpc("room_availability", {
    complex_ids: records.map((record) => record.id),
  });
  if (stock.error) unavailable("room-availability", stock.error);
  return parseComplexRows(records, stockByComplex((stock.data ?? []) as RoomAvailabilityRecord[]));
}

/** Застройщики для «+ Добавить ЖК» и вкладки «Основное»: в порядке списка, без архивных. */
export async function readDeveloperOptions(supabase: SupabaseClient): Promise<DeveloperOption[]> {
  const { data, error } = await supabase
    .from("developers")
    .select("id, name")
    .neq("status", "archived")
    .order("sort")
    .order("name");
  if (error) unavailable("developer-options", error);
  return (data ?? []) as DeveloperOption[];
}

/** ЖК страницы; null — нет такого (или не виден по RLS) → notFound(). */
export async function readComplex(
  supabase: SupabaseClient,
  id: string,
): Promise<ComplexRecord | null> {
  const { data, error } = await supabase
    .from("complexes")
    .select(COMPLEX_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) unavailable("complex", error);
  return data ? complexFrom(data as unknown as ComplexDbRow) : null;
}

export async function readReadiness(
  supabase: SupabaseClient,
  id: string,
): Promise<ReadinessItem[]> {
  const { data, error } = await supabase.rpc("complex_readiness", { p_complex: id });
  if (error) unavailable("complex-readiness", error);
  return parseReadiness((data ?? []) as ReadinessRecord[]);
}

/** Этажность по блокам (И3): min и max «этажей всего»; null — блоков с этажностью нет. */
export async function readFloorsRange(
  supabase: SupabaseClient,
  id: string,
): Promise<{ min: number; max: number } | null> {
  const { data, error } = await supabase
    .from("blocks")
    .select("floors_total")
    .eq("complex_id", id)
    .not("floors_total", "is", null);
  if (error) unavailable("complex-floors", error);
  const floors = (data ?? []).map((row) => Number(row.floors_total));
  return floors.length > 0 ? { min: Math.min(...floors), max: Math.max(...floors) } : null;
}

/** Фото и чертежи ЖК для панели публикации (правило 1.2): фото — по порядку галереи. */
export async function readComplexFiles(
  supabase: SupabaseClient,
  id: string,
): Promise<{ id: string; path: string; kind: "photo" | "drawing" }[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, path, kind")
    .eq("complex_id", id)
    .in("kind", ["photo", "drawing"])
    .order("kind")
    .order("sort")
    .order("created_at");
  if (error) unavailable("complex-files", error);
  return (data ?? []) as { id: string; path: string; kind: "photo" | "drawing" }[];
}

type BlockRow = Omit<BlockRecord, "units" | "priced_layouts"> & {
  units: { count: number }[];
  layouts: { price_from: number | string | null }[];
};

/** Блоки ЖК по порядку на сайте: сколько квартир (удалять нельзя) и планировок с ценой. */
export async function readBlocks(
  supabase: SupabaseClient,
  complexId: string,
): Promise<BlockDraft[]> {
  const { data, error } = await supabase
    .from("blocks")
    .select(
      "id, name, build_status, progress_pct, floors_total, floors_built, deadline_year, deadline_quarter, finishing_id, cadastre, cadastre_expected_on, currency, price_includes, units(count), layouts(price_from)",
    )
    .eq("complex_id", complexId)
    .order("sort")
    .order("name");
  if (error) unavailable("blocks", error);
  const rows = (data ?? []) as unknown as BlockRow[];
  return blockDraftsFrom(
    rows.map(({ units, layouts, ...row }) => ({
      ...row,
      units: units[0]?.count ?? 0,
      priced_layouts: layouts.filter((layout) => layout.price_from !== null).length,
    })),
  );
}

type LayoutRow = {
  id: string;
  rooms: number;
  area: number | string;
  drawing_id: string | null;
  price_from: number | string | null;
  available: boolean;
  units: { count: number }[];
  drawing: { path: string } | null;
};

type BlockLayoutsRow = {
  id: string;
  name: string;
  currency: string;
  units: { count: number }[];
  layouts: LayoutRow[];
};

type OfferRow = {
  layout_id: string;
  free_count: number | null;
  price_from: number | string | null;
};

const decimalText = (value: number | string | null) =>
  value === null ? "" : String(Number(value)).replace(".", ",");

/** Планировки по блокам (И5); src — ссылка на чертёж, «цена от» блока с квартирами — из квартир. */
export async function readBlockLayouts(
  supabase: SupabaseClient,
  complexId: string,
  src: (path: string) => string,
): Promise<BlockLayouts[]> {
  const [blocks, offers] = await Promise.all([
    supabase
      .from("blocks")
      .select(
        "id, name, currency, units(count), layouts(id, rooms, area, drawing_id, price_from, available, units(count), drawing:media_assets!layouts_drawing_id_fkey(path))",
      )
      .eq("complex_id", complexId)
      .order("sort")
      .order("name"),
    supabase.rpc("layout_availability", { target_complex: complexId }),
  ]);
  if (blocks.error) unavailable("block-layouts", blocks.error);
  if (offers.error) unavailable("layout-offers", offers.error);
  const offerOf = new Map(((offers.data ?? []) as OfferRow[]).map((row) => [row.layout_id, row]));
  return ((blocks.data ?? []) as unknown as BlockLayoutsRow[]).map((block) => {
    const hasUnits = (block.units[0]?.count ?? 0) > 0;
    const layouts = block.layouts.map((layout) => {
      const offer = offerOf.get(layout.id);
      return {
        key: layout.id,
        id: layout.id,
        rooms: layout.rooms,
        area: decimalText(layout.area),
        drawingId: layout.drawing_id,
        drawingSrc: layout.drawing ? src(layout.drawing.path) : null,
        priceFrom: decimalText(layout.price_from),
        available: layout.available,
        units: layout.units[0]?.count ?? 0,
        offer:
          hasUnits && offer
            ? {
                freeCount: offer.free_count,
                priceFrom: offer.price_from === null ? null : Number(offer.price_from),
              }
            : null,
      };
    });
    return {
      blockId: block.id,
      blockName: block.name,
      currency: block.currency === "UZS" ? "UZS" : "USD",
      hasUnits,
      layouts: sortLayouts(layouts),
    };
  });
}
