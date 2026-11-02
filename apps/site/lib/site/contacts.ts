import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { SITE_SETTINGS_TAG } from "@/lib/cache";
import { contactsFrom, NO_CONTACTS, SITE_CONTACTS_KEY, type SiteContacts } from "@/lib/contacts";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

// Контакты Vodiy House на сайте (Ф9): представление public_settings ролью посетителя (таблица ему
// закрыта, Проект-2 фаза B), в кэше оболочки;
// «Сохранить» в «Настройки → Контакты» сбрасывает SITE_SETTINGS_TAG.

async function fetchSiteContacts(): Promise<SiteContacts> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  cacheLife("days");
  const { data, error } = await createSupabasePublicClient()
    .from("public_settings")
    .select("value")
    .eq("key", SITE_CONTACTS_KEY)
    .maybeSingle();
  if (error) throw new Error("site-contacts-unavailable", { cause: error });
  return contactsFrom(data?.value);
}

/** Нет облака или база не ответила — сайт без телефона и Telegram, а не ошибка страницы. */
export async function readSiteContacts(): Promise<SiteContacts> {
  if (!hasSupabaseEnv()) return NO_CONTACTS;
  try {
    return await fetchSiteContacts();
  } catch (error) {
    console.error("[site] контакты Vodiy House недоступны", error);
    return NO_CONTACTS;
  }
}
