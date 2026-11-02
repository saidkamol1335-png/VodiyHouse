import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { contactsFrom, SITE_CONTACTS_KEY, type SiteContacts } from "@/lib/contacts";

// «Настройки → Контакты» сессией руководителя. Ошибка — как у справочников: экран ошибки.
export async function readContactsSettings(supabase: SupabaseClient): Promise<SiteContacts> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SITE_CONTACTS_KEY)
    .maybeSingle();
  if (error) throw new Error("contacts-unavailable", { cause: error });
  return contactsFrom(data?.value);
}
