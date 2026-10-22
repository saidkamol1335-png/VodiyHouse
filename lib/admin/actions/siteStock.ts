"use server";

import type { SiteStockResult } from "@/lib/admin/home/siteStock";
import { requireActionViewer } from "@/lib/admin/session";
import { readSiteStock } from "@/lib/admin/server/siteStock";

// Перечитывание «Остатков по ЖК» на главной раз в минуту (Г4 A). Отдельный файл: действие только
// читает, кэш сайта ему сбрасывать нечего (lib/cache/cache.test.ts).

/** Главная — руководителю и менеджеру; видеограф до раздела «Видео» видит заглушку. */
export async function readSiteStockAction(): Promise<SiteStockResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  try {
    return { status: "done", stock: await readSiteStock(guard.supabase) };
  } catch {
    return { status: "error", error: "unavailable" };
  }
}
