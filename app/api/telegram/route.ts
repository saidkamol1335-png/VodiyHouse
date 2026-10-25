import { botConfig } from "@/lib/leads/server/channels";
import { isTelegramRequest, processTelegramUpdate } from "@/lib/leads/server/telegram";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

// Вебхук бота «Написать в Telegram» (шаг 3.8): Telegram присылает обновления с секретом в
// заголовке (scripts/bot-webhook.mjs ставит адрес и секрет). Ответ — всегда 200 после обработки:
// иначе Telegram повторяет то же обновление снова и снова.

const ok = () => new Response(null, { status: 200 });

export async function POST(request: Request) {
  const config = botConfig();
  if (!config || !hasSupabaseAdminEnv()) return new Response("bot is off", { status: 503 });
  if (!isTelegramRequest(request, config)) return new Response("forbidden", { status: 403 });
  const update = await request.json().catch(() => null);
  if (!update || typeof update !== "object") return ok();
  try {
    await processTelegramUpdate(update, config);
  } catch (error) {
    console.error("[bot] обновление не обработано", error);
  }
  return ok();
}
