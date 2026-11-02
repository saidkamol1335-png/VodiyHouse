import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminEnv } from "@/lib/supabase/env";
import { handleTelegramUpdate, type TelegramUpdate } from "./bot";
import { botConfig, sendTelegram, telegramConfig, type BotConfig } from "./channels";
import { sameSecret } from "./secret";
import { rateKey, submitLead, visitorKey } from "./submit";

// Сервер бота «Написать в Telegram» (Ф8): код перехода по нажатию кнопки и вебхук Bot API. Без
// токена, секрета вебхука или секретного ключа базы бот выключен: кнопка ведёт на аккаунт.

export type TgStartInput = {
  site_lang: "ru" | "uz";
  object: Record<string, string | undefined>;
  page_url: string | null;
  source: Record<string, string>;
};

/** Код для t.me/<бот>?start=<код>; бот выключен или база отказала — null. */
export async function createTgStart(start: TgStartInput): Promise<string | null> {
  if (!botConfig() || !hasSupabaseAdminEnv()) return null;
  const { data, error } = await createSupabaseAdminClient().rpc("create_tg_start", {
    p_start: start,
    p_client_key: await visitorKey(),
  });
  if (error) {
    if (error.hint !== "vh:rate_limited") console.error("[bot] код перехода не создан", error.code, error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}

/** Запрос от Telegram — по секрету вебхука (setWebhook secret_token), сравнение без утечки по времени. */
export function isTelegramRequest(request: Request, config: BotConfig): boolean {
  const given = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  return sameSecret(given, config.webhookSecret);
}

export async function processTelegramUpdate(update: TelegramUpdate, config: BotConfig): Promise<void> {
  const admin = createSupabaseAdminClient();
  // Telegram повторяет обновление, если не дождался ответа: второй раз — не вторая заявка.
  if (typeof update.update_id === "number") {
    const { data, error } = await admin.rpc("take_tg_update", { p_update: update.update_id });
    // Отметка не записалась — обрабатываем всё равно: возможный дубль (repeat_of) лучше потерянной заявки.
    if (error) console.error("[bot] отметка обновления не записана", error.message);
    if (data === false) return;
  }
  // Заявки бот публикует тем же ботом — его токен и для ответов клиенту.
  const sender = telegramConfig() ?? { token: config.token, chatId: "", alertChatId: "" };
  await handleTelegramUpdate(update, {
    admin,
    reply: (chatId, text, keyboard) => sendTelegram(sender, chatId, text, keyboard),
    submit: (lead, clientKey) => submitLead(lead, clientKey),
    chatKey: (chatId) => rateKey("tg", String(chatId)),
  });
}
