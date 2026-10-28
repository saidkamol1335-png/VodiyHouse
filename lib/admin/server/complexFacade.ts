import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Point, UnitContour } from "../facade/contours";
import type { FacadeBlock, FacadeImage, FacadePlan, FacadeTabData } from "../facade/types";

// Вкладка ЖК «Фасад и планы» (фаза 4) сессией руководителя: фасад, блоки с контурами и местами
// на этаже (подъезды и позиции из списка квартир), планы этажей с картинками и контурами.

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

type Media = { path: string; width: number; height: number };
type BlockRow = { id: string; name: string; floors_total: number | null; facade_contour: Point[] | null };
type PlanRow = {
  id: string;
  block_id: string;
  entrance: number | null;
  floor_from: number;
  floor_to: number;
  contours: UnitContour[];
  image: Media | null;
};
type SlotRow = { block_id: string; entrance: number; position: number };

const PAGE = 1000;

/** Места на этаже по блокам ЖК: PostgREST отдаёт до 1000 строк — читаем страницами. */
async function readSlots(supabase: SupabaseClient, blockIds: string[]): Promise<SlotRow[]> {
  const rows: SlotRow[] = [];
  if (blockIds.length === 0) return rows;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("units")
      .select("block_id, entrance, position")
      .in("block_id", blockIds)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) unavailable("facade-slots", error);
    rows.push(...((data ?? []) as SlotRow[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function blockFrom(row: BlockRow, slots: SlotRow[]): FacadeBlock {
  const own = new Map<string, { entrance: number; position: number }>();
  for (const slot of slots) {
    if (slot.block_id === row.id) own.set(`${slot.entrance}:${slot.position}`, { entrance: slot.entrance, position: slot.position });
  }
  const sorted = [...own.values()].sort((a, b) => a.entrance - b.entrance || a.position - b.position);
  return {
    id: row.id,
    name: row.name,
    floorsTotal: row.floors_total,
    contour: row.facade_contour,
    entrances: [...new Set(sorted.map((slot) => slot.entrance))],
    slots: sorted,
  };
}

export async function readComplexFacade(
  supabase: SupabaseClient,
  complexId: string,
  src: (path: string) => string,
): Promise<FacadeTabData> {
  const image = (media: Media): FacadeImage => ({ src: src(media.path), width: media.width, height: media.height });
  const [facade, blocks, plans] = await Promise.all([
    supabase.from("media_assets").select("path, width, height").eq("complex_id", complexId).eq("kind", "facade").maybeSingle(),
    supabase.from("blocks").select("id, name, floors_total, facade_contour").eq("complex_id", complexId).order("sort").order("name"),
    supabase
      .from("floor_plans")
      .select("id, block_id, entrance, floor_from, floor_to, contours, image:media_assets!floor_plans_image_id_fkey(path, width, height)")
      .eq("complex_id", complexId)
      .order("floor_from")
      .order("entrance", { nullsFirst: true }),
  ]);
  if (facade.error) unavailable("facade", facade.error);
  if (blocks.error) unavailable("facade-blocks", blocks.error);
  if (plans.error) unavailable("floor-plans", plans.error);
  const blockRows = (blocks.data ?? []) as BlockRow[];
  const slots = await readSlots(supabase, blockRows.map((row) => row.id));
  return {
    facade: facade.data ? image(facade.data as Media) : null,
    blocks: blockRows.map((row) => blockFrom(row, slots)),
    plans: ((plans.data ?? []) as unknown as PlanRow[]).flatMap((row): FacadePlan[] =>
      row.image
        ? [{ id: row.id, blockId: row.block_id, entrance: row.entrance, floorFrom: row.floor_from, floorTo: row.floor_to, image: image(row.image), contours: row.contours }]
        : [],
    ),
  };
}
