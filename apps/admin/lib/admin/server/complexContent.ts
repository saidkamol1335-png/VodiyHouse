import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DeadlineChange } from "../complexes/deadlines";
import { detailRows, type DetailRecord, type DetailRow } from "../complexes/details";
import { documentRows, type DocumentRecord, type DocumentRow } from "../complexes/documents";
import { videoDrafts, type VideoDraft, type VideoRecord } from "../complexes/videos";
import { readDictionary } from "./developers";

// Чтение вкладок «Видео», «Документы», «Детали» и истории сроков «Блоков» (шаг 3.5) сессией
// сотрудника. Ошибка базы — исключение: app/admin/error.tsx покажет «Кабинет временно недоступен».

function unavailable(what: string, cause: unknown): never {
  throw new Error(`${what}-unavailable`, { cause });
}

export async function readComplexDocuments(supabase: SupabaseClient, complexId: string): Promise<DocumentRow[]> {
  const [types, records] = await Promise.all([
    readDictionary(supabase, "document_types"),
    supabase.from("complex_documents").select("document_type_id, checked_on").eq("complex_id", complexId),
  ]);
  if (records.error) unavailable("complex-documents", records.error);
  return documentRows(types, (records.data ?? []) as DocumentRecord[]);
}

export async function readComplexVideos(supabase: SupabaseClient, complexId: string): Promise<VideoDraft[]> {
  const { data, error } = await supabase.from("complex_videos").select("youtube_id, title").eq("complex_id", complexId).order("sort");
  if (error) unavailable("complex-videos", error);
  return videoDrafts((data ?? []) as VideoRecord[]);
}

export async function readComplexDetails(supabase: SupabaseClient, complexId: string): Promise<DetailRow[]> {
  const [topics, records] = await Promise.all([
    readDictionary(supabase, "detail_topics"),
    supabase.from("complex_details").select("topic_id, text, photo_id").eq("complex_id", complexId),
  ]);
  if (records.error) unavailable("complex-details", records.error);
  return detailRows(topics, (records.data ?? []) as DetailRecord[]);
}

type DeadlineRow = {
  id: string;
  block_id: string;
  from_year: number;
  from_quarter: number;
  to_year: number;
  to_quarter: number;
  changed_on: string;
};

/** Переносы сроков ЖК — по блокам, от старых к новым (история на сайте — в том же порядке). */
export async function readDeadlineChanges(supabase: SupabaseClient, complexId: string): Promise<DeadlineChange[]> {
  const { data, error } = await supabase
    .from("deadline_changes")
    .select("id, block_id, from_year, from_quarter, to_year, to_quarter, changed_on")
    .eq("complex_id", complexId)
    .order("changed_on")
    // Как на сайте (complex_page_blocks): два переноса за день — в порядке записи.
    .order("created_at");
  if (error) unavailable("deadline-changes", error);
  return ((data ?? []) as DeadlineRow[]).map((row) => ({
    id: row.id,
    blockId: row.block_id,
    from: { year: row.from_year, quarter: row.from_quarter },
    to: { year: row.to_year, quarter: row.to_quarter },
    changedOn: row.changed_on,
  }));
}
