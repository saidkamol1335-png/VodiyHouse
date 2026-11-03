import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MyProgressReport,
  ProgressEdit,
  ProgressFormComplex,
  ProgressPhotoView,
  ProgressReportStatus,
  ReportDetail,
  ReviewItem,
} from "@/lib/admin/progress/types";
import { signProgressFiles } from "./progressFiles";

// «Видео и ход стройки» (фаза 5, Проект-2 фаза E): чтение экранов сессией сотрудника — права решает база
// (черновик видит только автор, мобилограф — только свои отчёты). Адреса файлов — signProgressFiles.

type ComplexRow = {
  id: string;
  name: { ru: string };
  blocks: { id: string; name: string; sort: number; build_status: "building" | "delivered" }[];
};

/** ЖК с хотя бы одним строящимся блоком — по названию; у ЖК — только строящиеся блоки по порядку. */
export async function readProgressFormComplexes(supabase: SupabaseClient): Promise<ProgressFormComplex[]> {
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

type PhotoRow = { id: string; path: string; width: number; height: number; blur: string | null; sort: number };

const sortedPhotos = (photos: readonly PhotoRow[]) => [...photos].sort((a, b) => a.sort - b.sort);

const photoViews = (photos: readonly PhotoRow[], urls: Map<string, string>): ProgressPhotoView[] =>
  sortedPhotos(photos).map(({ id, path, width, height, blur }) => ({
    id,
    path,
    width,
    height,
    blur,
    url: urls.get(path) ?? "",
  }));

type MineRow = {
  id: string;
  complex_id: string;
  block_id: string;
  is_unit: boolean;
  shot_on: string;
  status: ProgressReportStatus;
  return_note: string | null;
  updated_at: string;
  complex: { name: { ru: string } } | null;
  block: { name: string } | null;
  unit: { number: string } | null;
  photos: { path: string; sort: number }[];
};

/** «Мои отчёты»: только отчёты автора (и у руководителя — свои), новые сверху. */
export async function readAuthorProgressReports(
  supabase: SupabaseClient,
  authorId: string,
  { status, limit = 100 }: { status?: ProgressReportStatus; limit?: number } = {},
): Promise<MyProgressReport[]> {
  let query = supabase
    .from("progress_reports")
    .select(
      "id, complex_id, block_id, is_unit, shot_on, status, return_note, updated_at, complex:complexes(name), block:blocks(name), unit:units(number), photos:progress_photos(path, sort)",
    )
    .eq("author_id", authorId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error("progress-reports-unavailable", { cause: error });
  const rows = data as unknown as MineRow[];
  const thumbs = rows.map((row) => [...row.photos].sort((a, b) => a.sort - b.sort)[0]?.path ?? null);
  const urls = await signProgressFiles(thumbs);
  return rows.map((row, index) => ({
    id: row.id,
    complexId: row.complex_id,
    complexName: row.complex?.name.ru ?? "",
    blockId: row.block_id,
    blockName: row.block?.name ?? "",
    unitNumber: row.unit?.number ?? null,
    isUnit: row.is_unit,
    shotOn: row.shot_on,
    status: row.status,
    returnNote: row.return_note,
    updatedAt: row.updated_at,
    photos: row.photos.length,
    thumbUrl: thumbs[index] ? (urls.get(thumbs[index]!) ?? null) : null,
  }));
}

type EditRow = {
  id: string;
  status: ProgressReportStatus;
  complex_id: string;
  block_id: string;
  unit_id: string | null;
  shot_on: string;
  comment: { ru: string; uz: string };
  youtube_id: string | null;
  video_path: string | null;
  return_note: string | null;
  photos: PhotoRow[];
};

/** Черновик (только автору — RLS) или возвращённый отчёт для формы; иначе null. */
export async function readProgressReportForEdit(supabase: SupabaseClient, id: string): Promise<ProgressEdit | null> {
  const { data, error } = await supabase
    .from("progress_reports")
    .select(
      "id, status, complex_id, block_id, unit_id, shot_on, comment, youtube_id, video_path, return_note, photos:progress_photos(id, path, width, height, blur, sort)",
    )
    .eq("id", id)
    .in("status", ["draft", "returned"])
    .maybeSingle();
  if (error) throw new Error("progress-edit-unavailable", { cause: error });
  if (!data) return null;
  const row = data as unknown as EditRow;
  const urls = await signProgressFiles([...row.photos.map((photo) => photo.path), row.video_path]);
  return {
    id: row.id,
    status: row.status as ProgressEdit["status"],
    complexId: row.complex_id,
    blockId: row.block_id,
    unitId: row.unit_id,
    shotOn: row.shot_on,
    comment: row.comment,
    youtubeId: row.youtube_id,
    videoPath: row.video_path,
    videoUrl: row.video_path ? (urls.get(row.video_path) ?? null) : null,
    photos: photoViews(row.photos, urls),
    returnNote: row.return_note,
  };
}

const DETAIL_SELECT =
  "id, status, author_id, is_unit, month, shot_on, created_at, updated_at, comment, youtube_id, video_path, return_note, complex:complexes(name, slug), block:blocks(name), unit:units(number), author:profiles!progress_reports_author_id_fkey(full_name), photos:progress_photos(id, path, width, height, blur, sort)";

type DetailRow = {
  id: string;
  status: ProgressReportStatus;
  author_id: string | null;
  is_unit: boolean;
  month: string;
  shot_on: string;
  created_at: string;
  updated_at: string;
  comment: { ru: string; uz: string };
  youtube_id: string | null;
  video_path: string | null;
  return_note: string | null;
  complex: { name: { ru: string }; slug: string } | null;
  block: { name: string } | null;
  unit: { number: string } | null;
  author: { full_name: string } | null;
  photos: PhotoRow[];
};

function detailFrom(row: DetailRow, urls: Map<string, string>): ReportDetail {
  return {
    id: row.id,
    status: row.status,
    authorId: row.author_id,
    complexName: row.complex?.name.ru ?? "",
    complexSlug: row.complex?.slug ?? "",
    blockName: row.block?.name ?? "",
    unitNumber: row.unit?.number ?? null,
    isUnit: row.is_unit,
    month: row.month,
    shotOn: row.shot_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.author?.full_name ?? null,
    comment: row.comment,
    youtubeId: row.youtube_id,
    videoPath: row.video_path,
    videoUrl: row.video_path ? (urls.get(row.video_path) ?? null) : null,
    photos: photoViews(row.photos, urls),
    returnNote: row.return_note,
  };
}

/** «Ждут проверки» (руководитель и менеджер видят отправленные отчёты): старые сверху. */
export async function readReviewQueue(supabase: SupabaseClient): Promise<ReviewItem[]> {
  const { data, error } = await supabase
    .from("progress_reports")
    .select(DETAIL_SELECT)
    .eq("status", "review")
    .order("created_at", { ascending: true })
    .limit(50);
  if (error) throw new Error("progress-review-unavailable", { cause: error });
  const rows = data as unknown as DetailRow[];
  const thumbs = rows.map((row) => sortedPhotos(row.photos)[0]?.path ?? null);
  const urls = await signProgressFiles(thumbs);
  return rows.map((row, index) => ({
    id: row.id,
    complexName: row.complex?.name.ru ?? "",
    blockName: row.block?.name ?? "",
    unitNumber: row.unit?.number ?? null,
    month: row.month,
    shotOn: row.shot_on,
    createdAt: row.created_at,
    author: row.author?.full_name ?? null,
    photos: row.photos.length,
    video: Boolean(row.youtube_id || row.video_path),
    thumbUrl: thumbs[index] ? (urls.get(thumbs[index]!) ?? null) : null,
  }));
}

/** Ящик отчёта: любой статус, который сотруднику видно по RLS (черновик — только автору); нет — null. */
export async function readReportDetail(supabase: SupabaseClient, id: string): Promise<ReportDetail | null> {
  const { data, error } = await supabase.from("progress_reports").select(DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error("progress-report-unavailable", { cause: error });
  if (!data) return null;
  const row = data as unknown as DetailRow;
  const urls = await signProgressFiles([...row.photos.map((photo) => photo.path), row.video_path]);
  return detailFrom(row, urls);
}
