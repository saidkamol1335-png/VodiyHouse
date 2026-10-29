import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMatrix, type MatrixComplex, type MatrixReport } from "@/lib/admin/progress/matrix";
import { matrixMonths, type ClientVideo, type ProgressMatrix } from "@/lib/admin/progress/types";
import { complexRoute } from "@/lib/routes";
import { COMPLEX_ANCHORS } from "@/lib/site/complex/sections";

type OverviewVideo = {
  id: string;
  is_unit: boolean;
  month: string;
  shot_at: string;
  complex: string;
  slug: string;
  block: string;
  unit: string | null;
  author: string | null;
  thumb: string | null;
};

type Overview = {
  complexes: MatrixComplex[];
  reports: {
    id: string;
    complex_id: string;
    month: string;
    status: MatrixReport["status"];
    published_at: string | null;
  }[];
  videos: OverviewVideo[];
};

/** Ссылка клиенту (как в мокапе — /ru): видео квартиры — его страница, отчёт блока — «Ход строительства» ЖК. */
const clientPath = (video: OverviewVideo) =>
  video.is_unit
    ? `/ru/video/${video.id}`
    : `/ru${complexRoute(video.slug)}#${COMPLEX_ANCHORS.progress}`;

/**
 * Обзор для всех ролей (мокап CabReview): матрица «Отчёты по ЖК · последние 6 месяцев» и «Видео для
 * клиентов · последние». Функция базы: видеографу таблица отдаёт только свои отчёты, а матрица — общая.
 */
export async function readProgressOverview(
  supabase: SupabaseClient,
  now: Date,
): Promise<{ matrix: ProgressMatrix; videos: ClientVideo[] }> {
  const { data, error } = await supabase.rpc("progress_overview");
  if (error || !data) throw new Error("progress-overview-unavailable", { cause: error });
  const overview = data as Overview;
  const reports: MatrixReport[] = overview.reports.map((report) => ({
    id: report.id,
    complexId: report.complex_id,
    month: report.month,
    status: report.status,
    publishedAt: report.published_at,
  }));
  return {
    matrix: buildMatrix(overview.complexes, reports, matrixMonths(now), now),
    videos: overview.videos.map((video) => ({
      id: video.id,
      complexName: video.complex,
      blockName: video.block,
      unitNumber: video.unit,
      isUnit: video.is_unit,
      month: video.month,
      shotAt: video.shot_at,
      author: video.author,
      thumb: video.thumb,
      path: clientPath(video),
    })),
  };
}
