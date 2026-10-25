import { leadsCsv } from "@/lib/admin/leads/csv";
import { leadsFilterFrom } from "@/lib/admin/leads/screen";
import { readLeadsScreen } from "@/lib/admin/server/leads";
import { requireActionViewer } from "@/lib/admin/session";

// «CSV» в «Заявках» (мокап CabLeads): та же выборка, что на экране, файлом для Excel. Руководитель
// и менеджер; права ещё раз проверяет leads_screen(). Больше LIMIT — последняя строка «файл неполный».

// На строку меньше потолка leads_screen (500): 500-я строка выборки говорит, что есть ещё.
const LIMIT = 499;

export async function GET(request: Request) {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return new Response("forbidden", { status: guard.code === "session" ? 401 : 403 });
  const filter = leadsFilterFrom(Object.fromEntries(new URL(request.url).searchParams));
  // На строку больше потолка: ровно LIMIT заявок — файл полный, больше — пометка «неполный».
  const screen = await readLeadsScreen(guard.supabase, filter, LIMIT + 1);
  return new Response(leadsCsv(screen.rows.slice(0, LIMIT), screen.rows.length > LIMIT ? LIMIT : undefined), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="vodiyhouse-zayavki.csv"',
      "cache-control": "no-store",
    },
  });
}
