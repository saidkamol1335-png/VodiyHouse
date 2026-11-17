"use server";

import { DISCOUNTS_KEY } from "@vh/shared/discounts";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import type { HouseAdResult } from "@/lib/admin/houseAdResult";
import { requireActionViewer } from "@/lib/admin/session";
import { expirePrograms, expireShowcase, expireSiteSettings } from "@/lib/cache";

// «Витрина → Спецпредложения» (правки 15.11, п. 4 + 21): «Показывать скидки на сайте» — спецпредложения со
// скидкой и скидка за 100 % оплату в расчёте под планировкой. «Витрина» —
// только руководителю; права ещё раз проверяет RLS settings (правит руководитель), журнал — триггер.

export async function setDiscountsAction(enabled: boolean): Promise<HouseAdResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code };
  if (typeof enabled !== "boolean") return { status: "error", error: "invalid" };
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key: DISCOUNTS_KEY, value: { enabled }, is_public: true });
  if (error) return { status: "error", error: contentDbErrorCode(error) };
  // По этой записи база фильтрует витрину (site_showcase, 20261117150000) и отдаёт выгоду за 100 % в
  // программах оплаты (site_program, 20261117170000); сайт — ещё и сам. Сбросить все три кэша.
  expireSiteSettings();
  expireShowcase();
  expirePrograms();
  return { status: "saved", enabled };
}
