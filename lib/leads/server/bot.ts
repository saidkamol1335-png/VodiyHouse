import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTranslator } from "next-intl";
import { formatPhone } from "@/lib/format";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { objectFrom, pagePathFrom, sourceFrom, type LeadPayload } from "../request";
import type { LeadSubmitResult, SiteLang } from "../types";
import type { TelegramKeyboard } from "./channels";

// Бот «Написать в Telegram» (Ф8 A, ТЗ 10.5): /start <код> — приветствие на языке сайта и
// «Поделиться номером»; номер (кнопкой или текстом) — заявка «Telegram-бот» с ЖК, страницей и
// метками первого захода из кода. Дальше менеджер пишет клиенту со своего аккаунта: бот переписку
// не ведёт и не хранит. Сообщения групп (чат менеджеров, где бот публикует заявки) — не его дело.

type TelegramUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };

export type TelegramUpdate = {
  update_id?: number;
  message?: {
    chat: { id: number; type: string };
    from?: TelegramUser;
    text?: string;
    contact?: { phone_number: string; user_id?: number; first_name?: string; last_name?: string };
  };
};

export type BotDeps = {
  admin: SupabaseClient;
  reply: (chatId: number, text: string, keyboard?: TelegramKeyboard) => Promise<unknown>;
  submit: (lead: LeadPayload, clientKey: string) => Promise<LeadSubmitResult>;
  /** Ключ лимита частоты по чату (хэш, номер чата не хранится в заявках). */
  chatKey: (chatId: number) => string;
};

type TgStart = { code: string; site_lang: SiteLang; object: unknown; page_url: string | null; source: unknown };

const MESSAGES = { ru, uz } as const;
/** Текст «только номер»: цифры, пробелы, скобки, дефисы, «+». «Бюджет 450 000 000» номером не станет. */
const PHONE_TEXT = /^\+?[\d\s()-]{9,20}$/;
const translator = (lang: SiteLang) => createTranslator({ locale: lang, messages: MESSAGES[lang], namespace: "bot" });

/** Язык ответа: из кода (язык сайта) или из Telegram; по умолчанию — узбекский, как сайт. */
const langOf = (start: { site_lang?: SiteLang } | null, user?: TelegramUser): SiteLang =>
  start?.site_lang ?? (user?.language_code?.startsWith("ru") ? "ru" : "uz");

const shareKeyboard = (lang: SiteLang): TelegramKeyboard => ({
  keyboard: [[{ text: translator(lang)("share"), request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
});

export async function handleTelegramUpdate(update: TelegramUpdate, deps: BotDeps): Promise<void> {
  const message = update.message;
  if (!message || message.chat.type !== "private") return;
  const chatId = message.chat.id;
  const start = /^\/start(?:\s+([A-Za-z0-9_-]{8,64}))?$/.exec(message.text?.trim() ?? "");
  if (start) return greet(chatId, start[1] ?? null, message.from, deps);
  const text = message.text?.trim() ?? "";
  const phone = message.contact?.phone_number ?? (PHONE_TEXT.test(text) ? text : "");
  // Чужой контакт из записной книжки — не заявка этого человека.
  if (message.contact && message.contact.user_id !== message.from?.id) {
    const lang = langOf(null, message.from);
    await deps.reply(chatId, translator(lang)("ownContact"), shareKeyboard(lang));
    return;
  }
  if (message.contact || phone) return takePhone(chatId, phone, message, deps);
  const lang = langOf(await startFor(chatId, deps).catch(() => null), message.from);
  await deps.reply(chatId, translator(lang)("hint"), shareKeyboard(lang));
}

type BoundStart = { site_lang: SiteLang; complex: { ru: string; uz: string } | null };

async function greet(chatId: number, code: string | null, user: TelegramUser | undefined, deps: BotDeps) {
  let bound: BoundStart | null = null;
  if (code) {
    const { data, error } = await deps.admin.rpc("bind_tg_start", { p_code: code, p_chat: chatId });
    // Сбой базы — поздороваемся без ЖК; код останется, повторный /start его привяжет.
    if (error) console.error("[bot] код перехода не привязан", error.message);
    bound = (data as BoundStart | null) ?? null;
  }
  const lang = langOf(bound, user);
  const t = translator(lang);
  const lines = [t("greeting"), bound?.complex ? t("complex", { name: bound.complex[lang] }) : null, t("ask")];
  await deps.reply(chatId, lines.filter(Boolean).join("\n\n"), shareKeyboard(lang));
}

/** Контекст последнего /start; сбой базы — исключение: заявка без ЖК и меток хуже, чем «повторите». */
async function startFor(chatId: number, deps: BotDeps): Promise<TgStart | null> {
  const { data, error } = await deps.admin.rpc("tg_start_for_chat", { p_chat: chatId });
  if (error) throw new Error("tg-start-unavailable", { cause: error });
  return (data as TgStart | null) ?? null;
}

type BotMessage = NonNullable<TelegramUpdate["message"]>;

/** Номер → заявка «Telegram-бот» с контекстом последнего /start этого чата. */
async function takePhone(chatId: number, raw: string, message: BotMessage, deps: BotDeps) {
  const start = await startFor(chatId, deps).catch((error: unknown) => {
    console.error("[bot] контекст перехода не прочитан", error);
    return undefined;
  });
  if (start === undefined) {
    await deps.reply(chatId, translator(langOf(null, message.from))("failed"));
    return;
  }
  const lang = langOf(start, message.from);
  const t = translator(lang);
  const phone = formatPhone(raw);
  if (!phone) {
    await deps.reply(chatId, t("foreignPhone"), shareKeyboard(lang));
    return;
  }
  const person = message.contact ?? message.from;
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim().slice(0, 80) || "Telegram";
  const result = await deps.submit(leadOf(start, { name, phone, lang, username: message.from?.username }), deps.chatKey(chatId));
  if (result.status !== "sent") {
    await deps.reply(chatId, t("failed"));
    return;
  }
  if (start && result.id) {
    const { error } = await deps.admin.rpc("finish_tg_start", { p_code: start.code, p_lead: result.id });
    if (error) console.error("[bot] код перехода не закрыт", result.number, error.message);
  }
  await deps.reply(chatId, result.repeat ? t("repeat") : t("thanks", { number: result.number }), { remove_keyboard: true });
}

type Contact = { name: string; phone: string; lang: SiteLang; username?: string };

function leadOf(start: TgStart | null, contact: Contact): LeadPayload {
  return {
    type: "tg",
    name: contact.name,
    phone: contact.phone,
    contact_lang: contact.lang,
    site_lang: start?.site_lang ?? contact.lang,
    ...objectFrom(start?.object),
    page_url: pagePathFrom(start?.page_url),
    source: sourceFrom(start?.source),
    payload: contact.username ? { telegram: contact.username.slice(0, 32) } : {},
  };
}
