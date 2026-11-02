"use server";

import type { SiteNowResult } from "@/lib/admin/home/siteNow";
import { requireActionViewer } from "@/lib/admin/session";
import { readSiteNow } from "@/lib/admin/server/siteNow";

// Перечитывание «Сейчас на сайте» на главной кабинета (шаг 3.12). Только чтение — кэш сайта
// сбрасывать нечего (lib/cache/cache.test.ts).

export async function readSiteNowAction(): Promise<SiteNowResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  try {
    return { status: "done", now: await readSiteNow(guard.supabase) };
  } catch {
    return { status: "error", error: "unavailable" };
  }
}
