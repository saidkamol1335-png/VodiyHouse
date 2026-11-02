import "server-only";
import { callSigned, hasSignedWriteEnv, visitorKey } from "@/lib/supabase/signedWrite";

// «Написать в Telegram» (Ф8): код перехода в бота — подписанный вызов site_create_tg_start ролью
// посетителя (PLAN §10, п. 5). Сам бот (вебхук, заявка по номеру) живёт в админке.

export type TgStartInput = {
  site_lang: "ru" | "uz";
  object: Record<string, string | undefined>;
  page_url: string | null;
  source: Record<string, string>;
};

/** Код для t.me/<бот>?start=<код>; подпись не настроена или база отказала — null. */
export async function createTgStart(start: TgStartInput): Promise<string | null> {
  if (!hasSignedWriteEnv()) return null;
  const { data, error } = await callSigned<string>("site_create_tg_start", "tg-start", {
    start,
    client_key: await visitorKey(),
  });
  if (error) {
    if (error.hint !== "vh:rate_limited") console.error("[bot] код перехода не создан", error.code, error.message);
    return null;
  }
  return typeof data === "string" ? data : null;
}
