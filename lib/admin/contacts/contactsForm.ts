import {
  BOT_PATTERN,
  CALLBACK_MINUTES,
  FREE_SERVICES_MAX,
  INSTAGRAM_PATTERN,
  PHONE_PATTERN,
  TELEGRAM_PATTERN,
  type LocalizedText,
  type SiteContacts,
} from "@/lib/contacts";
import { bilingualIssue, bilingualOrNull, readBilingual, type BilingualIssue } from "../bilingual";
import { readText } from "../credentials";
import type { ContentErrorCode } from "../developers/errors";

// «Настройки → Контакты» (Ф9): контакты Vodiy House для сайта. Каждое поле необязательно — пустое
// прячет кнопку на сайте. Номер и имена принимаются в привычной записи («90 123 45 67», «@vodiy»,
// «t.me/vodiy») и хранятся в одной форме: сайт их только показывает.

export const CONTACTS_LIMITS = { hoursMax: 60, freeBadgeMax: 60, freeServiceMax: 60 } as const;

/** Поля пунктов плашки «Для вас бесплатно»: freeService0 … freeService3. */
export const FREE_SERVICE_FIELDS = Array.from(
  { length: FREE_SERVICES_MAX },
  (_, index) => `freeService${index}` as const,
);
type FreeServiceField = (typeof FREE_SERVICE_FIELDS)[number];

export type ContactsField =
  | "phone"
  | "telegram"
  | "bot"
  | "instagram"
  | "hours"
  | "callbackMinutes"
  | "freeBadge"
  | FreeServiceField;
export type ContactsIssue = BilingualIssue | "phone" | "telegram" | "bot" | "instagram" | "minutes";
export type ContactsErrors = Partial<Record<ContactsField, ContactsIssue>>;

/** Поля формы как набраны — чтобы после отказа ничего не пропало. */
export type ContactsFields = Record<
  "phone" | "telegram" | "bot" | "instagram" | "callbackMinutes",
  string
> &
  Record<"hours" | "freeBadge", LocalizedText> & { freeServices: LocalizedText[] };

export type ContactsActionResult =
  | { status: "idle" }
  | { status: "saved"; at: number }
  | {
      status: "error";
      error: ContentErrorCode | null;
      fieldErrors: ContactsErrors;
      fields?: ContactsFields;
    };

export type ContactsParse =
  | { ok: true; value: SiteContacts }
  | { ok: false; fieldErrors: ContactsErrors; fields: ContactsFields };

/** «90 123 45 67», «998 90 123-45-67», «+998 (90) 123 45 67» → «+998901234567»; иначе как есть. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[\s\-‐-―().]/g, "");
  if (/^\d{9}$/.test(digits)) return `+998${digits}`;
  if (/^998\d{9}$/.test(digits)) return `+${digits}`;
  return digits;
}

const PROFILE_LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|instagram\.com)\/(.+)$/i;

/**
 * «@vodiy», «t.me/vodiy», «https://www.instagram.com/vodiy/?hl=ru» → «vodiy». Чужая ссылка
 * (facebook.com/…, m.instagram.com/…) и путь глубже профиля («instagram.com/stories/…») остаются
 * со «/» — проверка имени их не пропустит, вместо «Instagram @www.facebook.com» на сайте.
 */
export function normalizeHandle(raw: string): string {
  const text = raw
    .trim()
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const profile = PROFILE_LINK.exec(text);
  if (profile) return profile[1]!;
  return /^https?:\/\/|\//i.test(text) ? text : text.replace(/^@/, "");
}

function readHandle(formData: FormData, name: string, pattern: RegExp) {
  const raw = (readText(formData, name) ?? "").trim();
  const value = raw ? normalizeHandle(raw) : "";
  return { raw, value: value || null, ok: !value || pattern.test(value) };
}

function readPhone(formData: FormData) {
  const raw = (readText(formData, "phone") ?? "").trim();
  const value = raw ? normalizePhone(raw) : "";
  return { raw, value: value || null, ok: !value || PHONE_PATTERN.test(value) };
}

function readMinutes(formData: FormData) {
  const raw = (readText(formData, "callbackMinutes") ?? "").trim();
  if (!raw) return { raw, value: null, ok: true };
  const value = Number(raw);
  const ok =
    Number.isInteger(value) && value >= CALLBACK_MINUTES.min && value <= CALLBACK_MINUTES.max;
  return { raw, value: ok ? value : null, ok };
}

function readContactsForm(formData: FormData) {
  return {
    phone: readPhone(formData),
    telegram: readHandle(formData, "telegram", TELEGRAM_PATTERN),
    bot: readHandle(formData, "bot", BOT_PATTERN),
    instagram: readHandle(formData, "instagram", INSTAGRAM_PATTERN),
    minutes: readMinutes(formData),
    hours: readBilingual(formData, "hours"),
    freeBadge: readBilingual(formData, "freeBadge"),
    freeServices: FREE_SERVICE_FIELDS.map((name) => readBilingual(formData, name)),
  };
}

type ContactsInput = ReturnType<typeof readContactsForm>;

function contactsErrors(input: ContactsInput): ContactsErrors {
  const errors: ContactsErrors = {};
  if (!input.phone.ok) errors.phone = "phone";
  if (!input.telegram.ok) errors.telegram = "telegram";
  if (!input.bot.ok) errors.bot = "bot";
  if (!input.instagram.ok) errors.instagram = "instagram";
  if (!input.minutes.ok) errors.callbackMinutes = "minutes";
  const hours = bilingualIssue(input.hours, { max: CONTACTS_LIMITS.hoursMax });
  const freeBadge = bilingualIssue(input.freeBadge, { max: CONTACTS_LIMITS.freeBadgeMax });
  if (hours) errors.hours = hours;
  if (freeBadge) errors.freeBadge = freeBadge;
  input.freeServices.forEach((service, index) => {
    const problem = bilingualIssue(service, { max: CONTACTS_LIMITS.freeServiceMax });
    if (problem) errors[FREE_SERVICE_FIELDS[index]!] = problem;
  });
  return errors;
}

/** Поля: phone, telegram, bot, instagram, hours.ru|uz, callbackMinutes, freeBadge.ru|uz, freeService0…3.ru|uz. */
export function parseContacts(formData: FormData): ContactsParse {
  const input = readContactsForm(formData);
  const fieldErrors = contactsErrors(input);
  if (Object.keys(fieldErrors).length > 0) {
    const { phone, telegram, bot, instagram, minutes, hours, freeBadge, freeServices } = input;
    const fields = {
      phone: phone.raw,
      telegram: telegram.raw,
      bot: bot.raw,
      instagram: instagram.raw,
      callbackMinutes: minutes.raw,
      hours,
      freeBadge,
      freeServices,
    };
    return { ok: false, fieldErrors, fields };
  }
  return {
    ok: true,
    value: {
      phone: input.phone.value,
      telegram: input.telegram.value,
      bot: input.bot.value,
      instagram: input.instagram.value,
      hours: bilingualOrNull(input.hours),
      callbackMinutes: input.minutes.value,
      freeBadge: bilingualOrNull(input.freeBadge),
      // Пустые строки пропускаются: пункт 3 без пункта 2 — просто второй пункт.
      freeServices: input.freeServices.flatMap((service) => bilingualOrNull(service) ?? []),
    },
  };
}

/** Сохранённые контакты → значения полей формы. */
export function contactsFields(contacts: SiteContacts): ContactsFields {
  return {
    phone: contacts.phone ?? "",
    telegram: contacts.telegram ?? "",
    bot: contacts.bot ?? "",
    instagram: contacts.instagram ?? "",
    callbackMinutes: contacts.callbackMinutes === null ? "" : String(contacts.callbackMinutes),
    hours: contacts.hours ?? { ru: "", uz: "" },
    freeBadge: contacts.freeBadge ?? { ru: "", uz: "" },
    freeServices: FREE_SERVICE_FIELDS.map(
      (_, index) => contacts.freeServices[index] ?? { ru: "", uz: "" },
    ),
  };
}
