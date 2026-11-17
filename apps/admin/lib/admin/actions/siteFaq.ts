"use server";

import { SITE_FAQ_KEY } from "@vh/shared/faq";
import { parseFaq } from "@/lib/admin/complexes/faq";
import type { FaqResult } from "@/lib/admin/complexes/types";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import { requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";

// «Настройки → Частые вопросы» (правки 15.11, п. 7 + 23): общие вопросы Vodiy House — на главной и на
// странице каждого ЖК. Правят руководитель и менеджер; формат и права ещё раз проверяет база
// (settings_site_faq_valid, политики 20261117100000), журнал — триггер settings_audit.

/** «Сохранить»: до 8 пар целиком; пустой список — на сайте блока нет. */
export async function saveSiteFaqAction(formData: FormData): Promise<FaqResult> {
  const guard = await requireActionViewer(["head", "manager"]);
  if (!guard.ok) return { status: "error", error: guard.code, errors: {}, broken: [] };
  const parsed = parseFaq(formData);
  if (!parsed.ok) {
    return { status: "error", error: parsed.error ?? null, errors: parsed.error ? {} : parsed.errors, broken: [] };
  }
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key: SITE_FAQ_KEY, value: parsed.payload, is_public: true }, { onConflict: "key" });
  if (error) return { status: "error", error: contentDbErrorCode(error), errors: {}, broken: [] };
  expireSiteSettings();
  return { status: "saved", at: Date.now() };
}
