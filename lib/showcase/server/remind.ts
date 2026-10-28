import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { formatDate } from "@/lib/format";
import { sendTelegram, telegramConfig } from "@/lib/leads/server/channels";
import { siteOrigin } from "@/lib/site/metadata";
import { reminderText, type ShowcaseReminder } from "../reminder";

// Витрина (3.16б, ТЗ 8.5): раз в сутки — напоминание руководителю за 3 дня до конца спецпредложения
// или рекламы, тем же каналом, что напоминания архива (чат тревог). База отмечает напоминание сразу
// (take_showcase_reminders): сбой отправки не повторит его каждую ночь; без бота — только в лог.

/** Напоминания — руководителю в Telegram; возвращает, сколько записей заканчивается. */
export async function remindShowcase(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("take_showcase_reminders");
  if (error) throw new Error("take-showcase-reminders-failed", { cause: error });
  const due = (data ?? []) as ShowcaseReminder[];
  const config = telegramConfig();
  if (!config) {
    if (due.length > 0) console.error("[vitrina] напоминания не отправлены: бот не настроен", due.map((item) => item.id));
    return due.length;
  }
  const origin = siteOrigin();
  for (const item of due) {
    const cabinet = `${origin}${item.kind === "ad" ? ADMIN_ROUTES.showcaseAds : ADMIN_ROUTES.showcaseSpecials}`;
    const result = await sendTelegram(config, config.alertChatId, reminderText(item, cabinet, formatDate));
    if (!result.ok) console.error("[vitrina] напоминание не отправлено", item.kind, item.id, result.error);
  }
  return due.length;
}
