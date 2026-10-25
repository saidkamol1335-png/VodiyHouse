"use server";

import { objectFrom, pagePathFrom, sourceFrom } from "./request";
import { createTgStart } from "./server/telegram";

// «Написать в Telegram» (Ф8): по нажатию — код перехода с ЖК, страницей и метками первого захода.
// Данные из браузера — как у заявки: только адрес ЖК и uuid, путь сайта, известные метки.

export async function telegramStartAction(request: unknown): Promise<string | null> {
  const raw = (typeof request === "object" && request !== null ? request : {}) as Record<string, unknown>;
  return createTgStart({
    site_lang: raw.siteLang === "ru" ? "ru" : "uz",
    object: objectFrom(raw.object),
    page_url: pagePathFrom(raw.pageUrl),
    source: sourceFrom(raw.source),
  });
}
