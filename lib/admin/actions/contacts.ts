"use server";

import { type ContactsActionResult, parseContacts } from "@/lib/admin/contacts/contactsForm";
import { contentDbErrorCode } from "@/lib/admin/developers/errors";
import { requireActionViewer } from "@/lib/admin/session";
import { expireSiteSettings } from "@/lib/cache";
import { SITE_CONTACTS_KEY } from "@/lib/contacts";

// «Настройки → Контакты» (Ф9): правит руководитель (PLAN §5); права ещё раз проверяет RLS
// settings, журнал — его триггер аудита. Запись публичная: её читает сайт ролью посетителя.

export async function saveContactsAction(formData: FormData): Promise<ContactsActionResult> {
  const guard = await requireActionViewer(["head"]);
  if (!guard.ok) return { status: "error", error: guard.code, fieldErrors: {} };
  const parsed = parseContacts(formData);
  if (!parsed.ok) {
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  }
  const { error } = await guard.supabase
    .from("settings")
    .upsert({ key: SITE_CONTACTS_KEY, value: parsed.value, is_public: true });
  if (error) return { status: "error", error: contentDbErrorCode(error), fieldErrors: {} };
  // Контакты — в шапке, меню и подвале каждой страницы: новый номер виден сразу.
  expireSiteSettings();
  return { status: "saved", at: Date.now() };
}
