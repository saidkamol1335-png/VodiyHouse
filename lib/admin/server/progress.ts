import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MyProgressReport,
  ProgressFormComplex,
  ProgressReportStatus,
} from "@/lib/admin/progress/types";

// «Видео и ход стройки» (фаза 5): чтение экрана сессией сотрудника — права решает база (видеограф видит
// ЖК и блоки как сотрудник, отчёты — только свои).

type ComplexRow = {
  id: string;
  name: { ru: string };
  blocks: { id: string; name: string; sort: number; build_status: "building" | "delivered" }[];
};

/** ЖК с хотя бы одним строящимся блоком — по названию; у ЖК — только строящиеся блоки по порядку. */
export async function readProgressFormComplexes(
  supabase: SupabaseClient,
): Promise<ProgressFormComplex[]> {
  const { data, error } = await supabase
    .from("complexes")
    .select("id, name, blocks(id, name, sort, build_status)")
    .neq("status", "archived");
  if (error) throw new Error("progress-complexes-unavailable", { cause: error });
  return (data as ComplexRow[])
    .map((complex) => ({
      id: complex.id,
      name: complex.name.ru,
      blocks: complex.blocks
        .filter((block) => block.build_status === "building")
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "ru"))
        .map(({ id, name }) => ({ id, name })),
    }))
    .filter((complex) => complex.blocks.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

type ReportRow = {
  id: string;
  complex_id: string;
  block_id: string;
  is_unit: boolean;
  month: string;
  status: ProgressReportStatus;
  return_note: string | null;
  created_at: string;
  complex: { name: { ru: string } } | null;
  block: { name: string } | null;
  unit: { number: string } | null;
  photos: { path: string; sort: number }[];
};

/** «Мои отчёты»: последние свои (у видеографа RLS отдаёт только свои) — новые сверху. */
export async function readMyProgressReports(
  supabase: SupabaseClient,
  limit = 5,
): Promise<MyProgressReport[]> {
  const { data, error } = await supabase
    .from("progress_reports")
    .select(
      "id, complex_id, block_id, is_unit, month, status, return_note, created_at, complex:complexes(name), block:blocks(name), unit:units(number), photos:progress_photos(path, sort)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("progress-reports-unavailable", { cause: error });
  return (data as unknown as ReportRow[]).map((row) => ({
    id: row.id,
    complexId: row.complex_id,
    complexName: row.complex?.name.ru ?? "",
    blockId: row.block_id,
    blockName: row.block?.name ?? "",
    unitNumber: row.unit?.number ?? null,
    isUnit: row.is_unit,
    month: row.month,
    status: row.status,
    returnNote: row.return_note,
    createdAt: row.created_at,
    thumb: [...row.photos].sort((a, b) => a.sort - b.sort)[0]?.path ?? null,
  }));
}
