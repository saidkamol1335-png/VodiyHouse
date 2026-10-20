import { readText } from "../credentials";

// Вкладка «Внутреннее» (developer_private): контакты застройщика и заметки — только кабинет,
// на сайт не попадают никогда (правило ТЗ 1.2). Пределы — как check в миграции.

export const PRIVATE_LIMITS = { contactsMax: 2000, notesMax: 4000 } as const;

export type PrivateNotes = { contacts: string; notes: string };
export type PrivateNotesErrors = Partial<Record<keyof PrivateNotes, "tooLong">>;
export type PrivateNotesParse =
  | { ok: true; value: PrivateNotes }
  | { ok: false; fields: PrivateNotes; fieldErrors: PrivateNotesErrors };

/** Переводы строк сохраняются (список телефонов отдела продаж); края — без пробелов. */
export function parsePrivateNotes(formData: FormData): PrivateNotesParse {
  const fields: PrivateNotes = {
    contacts: (readText(formData, "contacts") ?? "").trim(),
    notes: (readText(formData, "notes") ?? "").trim(),
  };
  const fieldErrors: PrivateNotesErrors = {};
  if (fields.contacts.length > PRIVATE_LIMITS.contactsMax) fieldErrors.contacts = "tooLong";
  if (fields.notes.length > PRIVATE_LIMITS.notesMax) fieldErrors.notes = "tooLong";
  return Object.keys(fieldErrors).length > 0
    ? { ok: false, fields, fieldErrors }
    : { ok: true, value: fields };
}
