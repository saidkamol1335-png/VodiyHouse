import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { progressReminderText, type ProgressReminder } from "@/lib/admin/progress/reminder";
import { formatDate } from "@/lib/format";
import { sendTelegram, telegramConfig } from "@/lib/leads/server/channels";
import { siteOrigin } from "@/lib/site/metadata";

// Ход строительства (5D.3, мокап CabReview): раз в сутки — одним сообщением в чат тревог, у каких ЖК
// последний отчёт старше 45 дней. ЖК отмечается перед отправкой (не чаще раза в 7 дней); не ушло —
// отметка снимается, завтра повтор. Без бота — только в лог, без отметки.

type Claim = { at: string; ids: string[] };

/** Напоминание руководителю и менеджерам в Telegram; возвращает, о скольких ЖК напомнили. */
export async function remindProgress(admin: SupabaseClient): Promise<number> {
  const due = await admin.rpc("progress_reminders_due");
  if (due.error) throw new Error("progress-reminders-failed", { cause: due.error });
  const items = (due.data ?? []) as ProgressReminder[];
  if (items.length === 0) return 0;
  const config = telegramConfig();
  if (!config) {
    console.error(
      "[progress] напоминание не отправлено: бот не настроен",
      items.map((item) => item.id),
    );
    return 0;
  }
  const claim = await admin.rpc("claim_progress_reminders", {
    p_ids: items.map((item) => item.id),
  });
  if (claim.error) throw new Error("progress-reminders-claim-failed", { cause: claim.error });
  const { at, ids } = claim.data as Claim;
  const claimed = items.filter((item) => ids.includes(item.id));
  if (claimed.length === 0) return 0;
  const cabinet = `${siteOrigin()}${ADMIN_ROUTES.video}`;
  const result = await sendTelegram(
    config,
    config.alertChatId,
    progressReminderText(claimed, cabinet, formatDate),
  );
  if (result.ok) return claimed.length;
  console.error("[progress] напоминание не отправлено", result.error);
  // `at` — строкой, как вернула база: в Date потерялись бы микросекунды, и отметка не снялась бы.
  const released = await admin.rpc("release_progress_reminders", { p_ids: ids, p_at: at });
  if (released.error)
    console.error("[progress] отметки напоминания не сняты", released.error.message);
  return 0;
}
