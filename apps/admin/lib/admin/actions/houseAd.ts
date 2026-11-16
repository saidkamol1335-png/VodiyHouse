"use server";

import { HOUSE_AD_KEY } from "@vh/shared/houseAd";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";

// «Витрина → Реклама» (06.11.2026): выключатель своей рекламы Vodiy House на главной. «Витрина» —
// только руководителю; права ещё раз проверяет RLS settings (правит руководитель), журнал — триггер.


export async function setHouseAdAction(enabled: boolean): Promise<HouseAdResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (typeof enabled !== "boolean") return { status: "error", error: "invalid" };
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key: HOUSE_AD_KEY, value: { enabled }, is_public: true });
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  // Блок рекламы — на главной: включение и выключение видно сразу.
  expireSiteSettings();
  return { status: "saved", enabled };
}
