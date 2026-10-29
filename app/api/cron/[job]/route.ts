import { CRON_JOBS } from "@/lib/leads/server/jobs";
import { sameSecret } from "@/lib/leads/server/secret";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

// Расписание (решение фазы 3): один защищённый адрес /api/cron/<работа>, его дёргает Netlify
// Scheduled Function (netlify/functions/cron.mts) с секретом CRON_SECRET. Без секрета адрес закрыт.
// Работы — lib/leads/server/jobs.ts: заявки, коды бота, события, архив, курс ЦБ, ход строительства.

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  return secret.length >= 16 && sameSecret(given, secret);
}

export async function POST(request: Request, { params }: RouteContext<"/api/cron/[job]">) {
  if (!authorized(request)) return json({ error: "forbidden" }, 403);
  const { job: name } = await params;
  const job = Object.hasOwn(CRON_JOBS, name) ? CRON_JOBS[name] : undefined;
  if (!job) return json({ error: "unknown job" }, 404);
  if (!hasSupabaseAdminEnv()) return json({ error: "not configured" }, 503);
  try {
    return json({ ok: true, ...(await job()) });
  } catch (error) {
    console.error("[cron] работа упала", error);
    // Причина — в ответ: его пишет в свой лог функция расписания (адрес и так закрыт секретом).
    // Только message: в cause бывают ответы базы.
    return json({ error: "failed", reason: error instanceof Error ? error.message : String(error) }, 500);
  }
}
