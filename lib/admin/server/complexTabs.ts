import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { blockDraftsFrom, type BlockDraft, type BlockRecord } from "../complexes/blocks";
import { sortLayouts, type BlockLayouts } from "../complexes/layouts";
import type { PhotoItem } from "../complexes/photos";

// Чтение вкладок страницы ЖК («Блоки», «Планировки», «Квартиры», «Фото») сессией сотрудника.
// Ошибка сети или базы — исключение: app/admin/error.tsx покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
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
        saved: { available: layout.available, priceFrom: decimalText(layout.price_from) },
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

type PhotoRow = {
  id: string;
  path: string;
  width: number;
  height: number;
  focus_x: number;
  focus_y: number;
};

/** Галерея ЖК по порядку: первое фото — обложка. */
export async function readComplexPhotos(
  supabase: SupabaseClient,
  complexId: string,
  src: (path: string) => string,
): Promise<PhotoItem[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, path, width, height, focus_x, focus_y")
    .eq("complex_id", complexId)
    .eq("kind", "photo")
    .order("sort")
    .order("created_at")
    .order("id");
  if (error) unavailable("complex-photos", error);
  return ((data ?? []) as PhotoRow[]).map((row) => ({
    id: row.id,
    src: src(row.path),
    width: row.width,
    height: row.height,
    focus: { x: row.focus_x, y: row.focus_y },
  }));
}
