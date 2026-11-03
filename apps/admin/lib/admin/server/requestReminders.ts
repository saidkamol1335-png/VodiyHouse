import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  draftsDigestText,
  requestReminderText,
  type DraftDigestItem,
  type RequestReminder,
} from "@/lib/admin/complexes/requests";
import { complexTabHref } from "@/lib/admin/complexes/tabs";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { adminOrigin } from "@/lib/admin/origin";
import { sendTelegram, telegramConfig } from "@/lib/leads/server/channels";

// Напоминания бота фазы D (PLAN §10, п. 30): запрос менеджера ждёт руководителя больше суток;
// раз в неделю — черновики старше 14 дней. Отметки ставит база при выдаче.

const link = (tab: "publication" | "main") => (complexId: string) =>
  `${adminOrigin()}${complexTabHref(`${ADMIN_ROUTES.complexes}/${complexId}`, tab)}`;

/** Сколько запросов напомнили. Без бота — в лог: отметка уже стоит, завтра напомнит снова. */
export async function remindRequests(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin.rpc("take_publication_reminders");
  if (error) throw new Error("publication-reminders-failed", { cause: error });
  const items = (data ?? []) as RequestReminder[];
  if (items.length === 0) return 0;
  const config = telegramConfig();
  if (!config) {
    console.error("[requests] напоминание не отправлено: бот не настроен", items.map((item) => item.id));
    return 0;
  }
  const sent = await sendTelegram(config, config.alertChatId, requestReminderText(items, link("publication")));
  if (!sent.ok) console.error("[requests] напоминание не отправлено", sent.error);
  return sent.ok ? items.length : 0;
}

/** Недельная сводка черновиков; не ушла — отметка снимается, следующий запуск повторит. */
export async function digestDrafts(admin: SupabaseClient): Promise<number> {
  const config = telegramConfig();
  if (!config) return 0;
  const { data, error } = await admin.rpc("take_drafts_digest");
  if (error) throw new Error("drafts-digest-failed", { cause: error });
  const items = (data ?? []) as DraftDigestItem[];
  if (items.length === 0) return 0;
  const sent = await sendTelegram(config, config.alertChatId, draftsDigestText(items, link("publication")));
  if (sent.ok) return items.length;
  console.error("[drafts] сводка не отправлена", sent.error);
  const released = await admin.rpc("release_drafts_digest");
  if (released.error) console.error("[drafts] отметка сводки не снята", released.error.message);
  return 0;
}
