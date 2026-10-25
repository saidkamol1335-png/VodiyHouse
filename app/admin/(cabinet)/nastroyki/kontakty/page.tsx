import { getTranslations } from "next-intl/server";
import { AdminPanel } from "@/components/AdminPanel";
import { ContactsForm } from "@/components/ContactsForm";
import { isCabinetOpenWithoutLogin } from "@/lib/admin/access";
import { saveContactsAction } from "@/lib/admin/actions/contacts";
import { contactsFields } from "@/lib/admin/contacts/contactsForm";
import { readContactsSettings } from "@/lib/admin/server/contacts";
import { requireSection } from "@/lib/admin/session";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const instant = false;

/** «Настройки → Контакты» (Ф9): контакты Vodiy House для шапки, меню и подвала сайта. */
export default async function SettingsContactsPage() {
  const { allowed } = await requireSection("settings");
  if (!allowed) return null;
  if (isCabinetOpenWithoutLogin || !hasSupabaseEnv()) {
    const t = await getTranslations("admin");
    return (
      <AdminPanel title={t("contacts.title")}>{t("developers.errors.notConfigured")}</AdminPanel>
    );
  }
  const contacts = await readContactsSettings(await createSupabaseServerClient());
  return <ContactsForm fields={contactsFields(contacts)} action={saveContactsAction} />;
}
