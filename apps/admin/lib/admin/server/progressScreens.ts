import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MediaComplex,
  MediaComplexItem,
  ProgressEdit,
  ProgressFormComplex,
  ProgressTasks,
  TaskStatus,
} from "@/lib/admin/progress/types";
import { signProgressFiles } from "./progressFiles";

// «Задания» мобилографа и «Медиа ЖК» (фаза E, пп. 34, 35): функции базы решают, кому что видно.

type TasksRow = {
  month: string;
  today: string;
  total: number;
  left: number;
  complexes: {
    id: string;
    name: string;
    total: number;
    left: number;
    blocks: { id: string; name: string; status: TaskStatus; report_id: string | null; mine: boolean; shot_on: string | null }[];
  }[];
};

/** «Задания» мобилографа на текущий месяц; другим ролям база отвечает null. */
export async function readProgressTasks(supabase: SupabaseClient): Promise<ProgressTasks | null> {
  const { data, error } = await supabase.rpc("progress_tasks");
  if (error) throw new Error("progress-tasks-unavailable", { cause: error });
  if (!data) return null;
  const row = data as TasksRow;
  return {
    month: row.month,
    today: row.today,
    total: Number(row.total),
    left: Number(row.left),
    complexes: row.complexes.map((complex) => ({
      id: complex.id,
      name: complex.name,
      total: Number(complex.total),
      left: Number(complex.left),
      blocks: complex.blocks.map((block) => ({
        id: block.id,
        name: block.name,
        status: block.status,
        reportId: block.report_id,
        mine: block.mine,
        shotOn: block.shot_on,
      })),
    })),
  };
}

type MediaComplexRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  building: boolean;
  reports: number;
  last_month: string | null;
};

/** «Медиа ЖК»: все ЖК вне архива — адрес, точка, сколько опубликованных отчётов. */
export async function readMediaComplexes(supabase: SupabaseClient): Promise<MediaComplexItem[]> {
  const { data, error } = await supabase.rpc("progress_media_complexes");
  if (error) throw new Error("progress-media-unavailable", { cause: error });
  return ((data ?? []) as MediaComplexRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    building: row.building,
    reports: Number(row.reports),
    lastMonth: row.last_month,
  }));
}

type MediaRow = {
  id: string;
  name: string;
  address: string | null;
  landmark: string | null;
  lat: number | null;
  lng: number | null;
  months: {
    month: string;
    reports: {
      id: string;
      is_unit: boolean;
      block: string;
      shot_on: string;
      youtube_id: string | null;
      video_path: string | null;
      photos: { path: string; width: number; height: number }[];
    }[];
  }[];
};

/** «Медиа ЖК» одного ЖК: опубликованные отчёты по месяцам (24 месяца), публичные адреса файлов. */
export async function readMediaComplex(supabase: SupabaseClient, complexId: string): Promise<MediaComplex | null> {
  const { data, error } = await supabase.rpc("progress_media", { p_complex: complexId });
  if (error) throw new Error("progress-media-unavailable", { cause: error });
  if (!data) return null;
  const row = data as MediaRow;
  const reports = row.months.flatMap((month) => month.reports);
  const urls = await signProgressFiles([
    ...reports.flatMap((report) => report.photos.map((photo) => photo.path)),
    ...reports.map((report) => report.video_path),
  ]);
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    landmark: row.landmark,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    months: row.months.map((month) => ({
      month: month.month,
      reports: month.reports.map((report) => ({
        id: report.id,
        isUnit: report.is_unit,
        block: report.block,
        shotOn: report.shot_on,
        youtubeId: report.youtube_id,
        videoUrl: report.video_path ? (urls.get(report.video_path) ?? null) : null,
        photos: report.photos.flatMap((photo) => {
          const url = urls.get(photo.path);
          return url ? [{ url, width: photo.width, height: photo.height }] : [];
        }),
      })),
    })),
  };
}

/**
 * ЖК и блок правки (черновик, возвращённый) — в выборе формы, даже если блок с тех пор сдан или в ЖК
 * не осталось строящихся: отчёт не переезжает в другой блок сам (ревью фазы E).
 */
export async function withEditTarget(
  supabase: SupabaseClient,
  complexes: ProgressFormComplex[],
  edit: ProgressEdit | null,
): Promise<ProgressFormComplex[]> {
  if (!edit) return complexes;
  const complex = complexes.find((item) => item.id === edit.complexId);
  if (complex?.blocks.some((block) => block.id === edit.blockId)) return complexes;
  const { data, error } = await supabase
    .from("blocks")
    .select("id, name, complex:complexes(name)")
    .eq("id", edit.blockId)
    .maybeSingle();
  if (error || !data) return complexes;
  const row = data as unknown as { id: string; name: string; complex: { name: { ru: string } } | null };
  const block = { id: row.id, name: row.name };
  if (complex) return complexes.map((item) => (item === complex ? { ...item, blocks: [...item.blocks, block] } : item));
  return [...complexes, { id: edit.complexId, name: row.complex?.name.ru ?? "", blocks: [block] }];
}
