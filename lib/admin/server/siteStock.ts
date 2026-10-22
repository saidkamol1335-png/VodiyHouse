import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOnSite, parseComplexRows, type ComplexRowRecord } from "../complexes/list";
import {
  siteStockFrom,
  type BlockAvailabilityRecord,
  type RoomOfferRecord,
  type SiteStock,
} from "../home/siteStock";

// «Остатки по ЖК» на главной (шаг 13) сессией сотрудника: строки ЖК — complex_rows(), остатки —
// функциями сайта по всем ЖК на сайте сразу (три запроса на всю панель, при любом числе ЖК).
// Ошибка сети или базы — исключение: страница покажет панель без цифр, действие — «не обновилось».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export async function readSiteStock(supabase: SupabaseClient): Promise<SiteStock> {
  const rows = await supabase.rpc("complex_rows");
  if (rows.error) unavailable("complex-rows", rows.error);
  // Сотруднику функции наличия отдают и черновики (предпросмотр) — ЖК на сайте выбираем сами.
  const complexes = parseComplexRows((rows.data ?? []) as ComplexRowRecord[], new Map()).filter(
    isOnSite,
  );
  if (complexes.length === 0) return { complexes: [] };
  const complexIds = complexes.map((complex) => complex.id);
  const [rooms, blocks] = await Promise.all([
    supabase.rpc("room_availability", { complex_ids: complexIds }),
    supabase.rpc("block_availability", { complex_ids: complexIds }),
  ]);
  if (rooms.error) unavailable("room-availability", rooms.error);
  if (blocks.error) unavailable("block-availability", blocks.error);
  return siteStockFrom(
    complexes,
    (rooms.data ?? []) as RoomOfferRecord[],
    (blocks.data ?? []) as BlockAvailabilityRecord[],
  );
}
