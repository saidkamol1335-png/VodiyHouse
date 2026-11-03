import { requireActionViewer } from "@/lib/admin/session";
import { readProgressStats, readSiteStats } from "@/lib/admin/server/stats";
import { statsCsv, statsCsvFilename } from "@/lib/stats/csv";
import { statsPeriodOf } from "@/lib/stats/period";

// «CSV» в «Статистике сайта» (мокап CabStats): цифры выбранного периода файлом для Excel. Только
// руководитель; права ещё раз проверяет site_stats(). Период — те же параметры адреса, что у экрана.

export async function GET(request: Request) {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return new Response("forbidden", { status: guard.code === "session" ? 401 : 403 });
  const period = statsPeriodOf(Object.fromEntries(new URL(request.url).searchParams));
  try {
    // «Ход стройки» не прочитался — строка об этом в файле; 503 — только если нет статистики сайта.
    const [stats, progress] = await Promise.all([
      readSiteStats(guard.supabase, period),
      readProgressStats(guard.supabase, period).catch(() => null),
    ]);
    return new Response(statsCsv(stats, progress), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${statsCsvFilename(stats)}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("unavailable", { status: 503, headers: { "cache-control": "no-store" } });
  }
}
