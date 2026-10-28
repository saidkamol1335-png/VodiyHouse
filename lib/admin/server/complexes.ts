import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplexFileKind } from "../complexes/types";
import { parseComplexRows, type ComplexListRow, type ComplexRowRecord } from "../complexes/list";
import { parseReadiness, type ReadinessItem, type ReadinessRecord } from "../complexes/readiness";
import {
  COMPLEX_COLUMNS,
  complexFrom,
  type ComplexDbRow,
  type ComplexRecord,
} from "../complexes/record";
import {
  stockByComplex,
  unassignedByComplex,
  type RoomAvailabilityRecord,
} from "../complexes/stock";
import type { DeveloperOption } from "../complexes/types";

// Чтение данных кабинета ЖК сессией сотрудника (RLS). Ошибка сети или базы — исключение:
// app/admin/error.tsx покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

/**
 * Строки списка «ЖК» с остатками по комнатам и свободными без планировки (три запроса на весь
 * список): правило пилюли — то же, что на главной.
 */
export async function readComplexRows(supabase: SupabaseClient): Promise<ComplexListRow[]> {
  const rows = await supabase.rpc("complex_rows");
  if (rows.error) unavailable("complex-rows", rows.error);
  const records = (rows.data ?? []) as ComplexRowRecord[];
  if (records.length === 0) return [];
  const complexIds = records.map((record) => record.id);
  const [stock, blocks] = await Promise.all([
    supabase.rpc("room_availability", { complex_ids: complexIds }),
    supabase.rpc("block_availability", { complex_ids: complexIds }),
  ]);
  if (stock.error) unavailable("room-availability", stock.error);
  if (blocks.error) unavailable("block-availability", blocks.error);
  return parseComplexRows(
    records,
    stockByComplex((stock.data ?? []) as RoomAvailabilityRecord[]),
    unassignedByComplex((blocks.data ?? []) as { complex_id: string; free_unassigned: number }[]),
  );
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

/**
 * Файлы ЖК для панели публикации (правило 1.2): фото — по порядку галереи, чертежи, фасад и планы
 * этажей (фаза 4) — у черновика они загружаются без отметки, проверяются здесь.
 */
export async function readComplexFiles(
  supabase: SupabaseClient,
  id: string,
): Promise<{ id: string; path: string; kind: ComplexFileKind }[]> {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id, path, kind")
    .eq("complex_id", id)
    .in("kind", ["photo", "drawing", "facade", "floor_plan"])
    .order("kind")
    .order("sort")
    .order("created_at");
  if (error) unavailable("complex-files", error);
  return (data ?? []) as { id: string; path: string; kind: ComplexFileKind }[];
}
