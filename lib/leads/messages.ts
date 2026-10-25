"use server";

import type { AbstractIntlMessages } from "next-intl";
import { getMessages } from "next-intl/server";
import { LAZY_SITE_MESSAGES, pickMessages } from "@/lib/i18n/clientMessages";
import { isLocale } from "@/lib/i18n/routing";

// Тексты окна заявки — при первом нажатии кнопки (LAZY_SITE_MESSAGES): в HTML страниц их нет.
// Только открытые тексты сайта на языке страницы — секретов и данных здесь нет.

export async function leadMessagesAction(locale: string): Promise<AbstractIntlMessages | null> {
  if (!isLocale(locale)) return null;
  return pickMessages(await getMessages({ locale }), LAZY_SITE_MESSAGES);
}
