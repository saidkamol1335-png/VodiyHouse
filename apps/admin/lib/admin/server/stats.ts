import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatsPeriod } from "@/lib/stats/period";
import type { ProgressStats, SiteStats } from "@/lib/stats/types";

// «Статистика сайта» (фаза 6) сессией руководителя: site_stats() и site_today() сами проверяют роль.
// Ошибка сети или базы — исключение: страница покажет панель «не прочиталась», CSV — 503.

export async function readSiteStats(
  supabase: SupabaseClient,
  period: StatsPeriod,
): Promise<SiteStats> {
  const { data, error } = await supabase.rpc("site_stats", {
    p_from: period.from,
    p_to: period.to,
  });
  if (error) throw new Error("site-stats-unavailable", { cause: error });
  return data as SiteStats;
}

/** Посетители сайта с полуночи по Ташкенту — KPI «Сайт сегодня» на Главной руководителя. */
export async function readSiteToday(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("site_today");
  if (error) throw new Error("site-today-unavailable", { cause: error });
  return Number(data ?? 0);
}

/** «Ход стройки» за тот же период (фаза F, п. 41): отдельный вызов — его сбой не прячет статистику сайта. */
export async function readProgressStats(
  supabase: SupabaseClient,
  period: StatsPeriod,
): Promise<ProgressStats> {
  const { data, error } = await supabase.rpc("progress_stats", {
    p_from: period.from,
    p_to: period.to,
  });
  if (error) throw new Error("progress-stats-unavailable", { cause: error });
  return data as ProgressStats;
}
