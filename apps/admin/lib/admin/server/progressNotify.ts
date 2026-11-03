import "server-only";
import { ADMIN_ROUTES } from "@/lib/admin/nav";
import { adminOrigin } from "@/lib/admin/origin";
import { progressSubmittedText, type ProgressNotice } from "@/lib/admin/progress/notify";
import { sendTelegram, telegramConfig } from "@/lib/leads/server/channels";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Уведомления об отчётах (фаза E, п. 36). Руководителю — в чат тревог (как запросы фазы D), автору — в
// его личный чат, если он привязал Telegram. Сбой отправки действие не роняет: отчёт уже сохранён.

/** Форма возвращённого отчёта — «Исправить» у автора. */
export const editUrl = (id: string) => adminOrigin() + ADMIN_ROUTES.videoNew + "?id=" + id;

/** Ящик отчёта в кабинете. */
export const reviewUrl = (id: string) => `${adminOrigin()}${ADMIN_ROUTES.video}?report=${id}`;

/** «На проверку» — руководителю; true — сообщение ушло. */
export async function notifyHeadSubmitted(notice: ProgressNotice, id: string): Promise<boolean> {
  const config = telegramConfig();
  if (!config) return false;
  const sent = await sendTelegram(config, config.alertChatId, progressSubmittedText(notice, reviewUrl(id)));
  if (!sent.ok) console.error("[progress] сообщение руководителю не ушло", sent.error);
  return sent.ok;
}

/** Автору в личный Telegram; не привязан, нет бота или автор — сам руководитель — false. */
export async function notifyAuthor(authorId: string | null, actorId: string, text: string): Promise<boolean> {
  if (!authorId || authorId === actorId) return false;
  const config = telegramConfig();
  if (!config) return false;
  const { data, error } = await createSupabaseAdminClient().rpc("staff_telegram_chat", { p_user: authorId });
  if (error) {
    console.error("[progress] чат автора не прочитан", error.message);
    return false;
  }
  if (data === null || data === undefined) return false;
  const sent = await sendTelegram(config, String(data), text);
  if (!sent.ok) console.error("[progress] сообщение автору не ушло", sent.error);
  return sent.ok;
}

/** Привязан ли Telegram у сотрудника (панель «Уведомления в Telegram» мобилографа). */
export async function hasStaffTelegram(userId: string): Promise<boolean> {
  const { data, error } = await createSupabaseAdminClient().rpc("staff_telegram_chat", { p_user: userId });
  if (error) throw new Error("staff-telegram-unavailable", { cause: error });
  return data !== null && data !== undefined;
}

/** Мобилограф отвязывает свой Telegram (руководителю база откажет: только сброс разработчика). */
export async function unlinkStaffTelegram(userId: string): Promise<boolean> {
  const { error } = await createSupabaseAdminClient().rpc("unlink_staff_telegram", { p_user: userId });
  if (error) console.error("[progress] Telegram не отвязан", error.message);
  return !error;
}
