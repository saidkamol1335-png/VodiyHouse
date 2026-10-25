"use server";

import { devOnly } from "../devOnly";
import { type ContactsActionResult, parseContacts } from "@/lib/admin/contacts/contactsForm";

// Подделка для стенда /dev/kontakty: настоящие проверки формы, без базы.
export async function demoSaveContactsAction(formData: FormData): Promise<ContactsActionResult> {
  devOnly();
  const parsed = parseContacts(formData);
  if (!parsed.ok) {
    return { status: "error", error: null, fieldErrors: parsed.fieldErrors, fields: parsed.fields };
  }
  return { status: "saved", at: Date.now() };
}
