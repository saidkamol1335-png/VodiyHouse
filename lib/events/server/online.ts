import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";

// Посетителей онлайн для частоты опроса «Выбрать квартиру» (site_online_count — только серверу).
// Опрашивает каждый открытый раздел, поэтому ответ базы держим 30 с в памяти сервера; одновременные
// запросы ждут один и тот же ответ.

const KEEP_MS = 30_000;
let last: { online: Promise<number | null>; at: number } | null = null;

async function countOnline(): Promise<number | null> {
  if (!hasSupabaseAdminEnv()) return null;
  try {
    const { data, error } = await createSupabaseAdminClient().rpc("site_online_count");
    if (!error) return Number(data ?? 0);
    console.error("[novostroyki/zhk] онлайн недоступен", error.message);
  } catch (error) {
    console.error("[novostroyki/zhk] онлайн недоступен", error);
  }
  return null;
}

/** null — база не ответила или нет ключа сервера. */
export function readOnlineVisitors(now = Date.now()): Promise<number | null> {
  if (!last || now - last.at >= KEEP_MS) last = { online: countOnline(), at: now };
  return last.online;
}
