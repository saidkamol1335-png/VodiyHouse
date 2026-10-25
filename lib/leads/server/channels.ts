import "server-only";
import type { LeadChannel } from "../types";

// Каналы доставки заявок (ТЗ 10.4) — за переменными окружения. Нет токена — канала нет: заявка
// сохраняется в кабинете, очереди по каналу не создаётся (тестовые бот, чат и таблица — у
// исполнителя, TODO-исполнитель). Секреты только на сервере, в браузер и журнал не попадают.

type Env = Record<string, string | undefined>;

export type TelegramConfig = { token: string; chatId: string; alertChatId: string };

/** Бот «Написать в Telegram» (Ф8): токен и секрет вебхука (заголовок X-Telegram-Bot-Api-Secret-Token). */
export type BotConfig = { token: string; webhookSecret: string };

export function botConfig(env: Env = process.env): BotConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !webhookSecret || webhookSecret.length < 16) return null;
  return { token, webhookSecret };
}
export type SheetConfig = { url: string; secret: string };

/** Telegram-чат менеджеров: бот и номер чата; тревоги — в свой чат руководителя или туда же. */
export function telegramConfig(env: Env = process.env): TelegramConfig | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_LEADS_CHAT_ID?.trim();
  if (!token || !chatId) return null;
  return { token, chatId, alertChatId: env.TELEGRAM_ALERT_CHAT_ID?.trim() || chatId };
}

/** Google Таблица: приёмник Apps Script (веб-приложение) и общий секрет (docs/leads-sheet.md). */
export function sheetConfig(env: Env = process.env): SheetConfig | null {
  const url = env.LEADS_SHEET_URL?.trim();
  const secret = env.LEADS_SHEET_SECRET?.trim();
  if (!url || !secret || !url.startsWith("https://")) return null;
  return { url, secret };
}

export function configuredChannels(env: Env = process.env): LeadChannel[] {
  return [
    ...(telegramConfig(env) ? (["telegram"] as const) : []),
    ...(sheetConfig(env) ? (["sheet"] as const) : []),
  ];
}

const TIMEOUT_MS = 8_000;

export type SendResult = { ok: true } | { ok: false; error: string };

/** Ответ без тела и чужие ошибки — коротко, без адресов: строка попадёт в кабинет. */
async function post(url: string, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
}

function failure(error: unknown): SendResult {
  const name = error instanceof Error ? error.name : "";
  return { ok: false, error: name === "TimeoutError" ? "timeout" : "network" };
}

/** Кнопки под полем ввода (reply_markup Bot API): «Поделиться номером» или убрать их. */
export type TelegramKeyboard =
  | { keyboard: { text: string; request_contact?: boolean }[][]; resize_keyboard: true; one_time_keyboard: true }
  | { remove_keyboard: true };

/** Сообщение ботом (Bot API sendMessage); простой текст — разметка Telegram не ломается на «_». */
export async function sendTelegram(
  config: TelegramConfig,
  chatId: string | number,
  text: string,
  keyboard?: TelegramKeyboard,
): Promise<SendResult> {
  try {
    const response = await post(`https://api.telegram.org/bot${config.token}/sendMessage`, {
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
    if (response.ok) return { ok: true };
    const body = (await response.json().catch(() => null)) as { description?: string } | null;
    return { ok: false, error: `telegram ${response.status}${body?.description ? `: ${body.description}` : ""}` };
  } catch (error) {
    return failure(error);
  }
}

/** Строка таблицы: приёмник проверяет секрет и отвечает {"ok":true} (302 Apps Script fetch проходит сам). */
export async function sendSheetRow(config: SheetConfig, row: Record<string, string | number>): Promise<SendResult> {
  try {
    const response = await post(config.url, { secret: config.secret, row });
    const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (response.ok && body?.ok) return { ok: true };
    return { ok: false, error: `sheet ${response.status}${body?.error ? `: ${body.error}` : ""}` };
  } catch (error) {
    return failure(error);
  }
}
