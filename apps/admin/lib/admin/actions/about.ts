"use server";

import { ABOUT_HISTORY_KEY, ABOUT_TEAM_KEY } from "@vh/shared/about";
import { type AboutParse, type AboutResult, parseHistory, parseTeam } from "@/lib/admin/about/forms";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import { type ActionGuard, requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";

// «Настройки → О компании» (правки 15.11, п. 25): «История» и «Команда» на /o-nas. Правит руководитель
// (как контакты); формат и согласие сотрудников ещё раз проверяет база (20261117120000), журнал —
// триггер settings_audit.

async function saveSetting<P>(guard: ActionGuard, key: string, parsed: AboutParse<P>): Promise<AboutResult> {
  if (!guard.ok) return { status: "error", error: guard.code, errors: {}, broken: [] };
  if (!parsed.ok) {
    return { status: "error", error: parsed.error ?? null, errors: parsed.error ? {} : parsed.errors, broken: [] };
  }
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key, value: parsed.payload, is_public: true }, { onConflict: "key" });
  if (error) return { status: "error", error: contentDbErrorCode(error), errors: {}, broken: [] };
  return { status: "saved", at: Date.now() };
}

/** «Сохранить» у «Истории»: события целиком, по году. */
export async function saveAboutHistoryAction(formData: FormData): Promise<AboutResult> {
  const guard = await requireActionViewer(["head"]);
  const result = await saveSetting(guard, ABOUT_HISTORY_KEY, parseHistory(formData));
  if (result.status === "saved") expireSiteSettings();
  return result;
}

/** «Сохранить» у «Команды»: сотрудники в порядке формы, каждый — с отметкой согласия. */
export async function saveAboutTeamAction(formData: FormData): Promise<AboutResult> {
  const guard = await requireActionViewer(["head"]);
  const result = await saveSetting(guard, ABOUT_TEAM_KEY, parseTeam(formData));
  if (result.status === "saved") expireSiteSettings();
  return result;
}
