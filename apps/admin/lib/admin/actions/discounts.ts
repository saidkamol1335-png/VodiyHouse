"use server";

import { DISCOUNTS_KEY } from "@vh/shared/discounts";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";

// «Витрина → Спецпредложения» (правки 15.11, п. 4 + 21): «Показывать скидки на сайте». «Витрина» —
// только руководителю; права ещё раз проверяет RLS settings (правит руководитель), журнал — триггер.

export async function setDiscountsAction(enabled: boolean): Promise<HouseAdResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (typeof enabled !== "boolean") return { status: "error", error: "invalid" };
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key: DISCOUNTS_KEY, value: { enabled }, is_public: true });
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  // Витрину сайт фильтрует по этой записи — она в SITE_SETTINGS_TAG: главная, каталог, ЖК.
  expireSiteSettings();
  return { status: "saved", enabled };
}
