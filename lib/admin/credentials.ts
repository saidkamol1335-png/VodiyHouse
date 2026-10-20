import { isStaffRole, type StaffRole } from "./access";
import type { PasswordField } from "./password";

// Разбор форм кабинета (FormData из Server Actions). Ошибки — коды для messages/ru.json.

export const EMAIL_MAX_LENGTH = 254;
/** Совпадает с check у profiles.full_name (тест сверяет с миграцией). */
export const STAFF_LIMITS = { fullNameMax: 80 } as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Одно текстовое значение поля; null — поля нет, это файл или ключ повторён (подделанная форма). */
export function readText(formData: FormData, name: string): string | null {
  const values = formData.getAll(name);
  if (values.length !== 1) return null;
  const [value] = values;
  return typeof value === "string" ? value : null;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(value);
}

type EmailIssue = "emailRequired" | "emailInvalid";

function emailIssue(email: string): EmailIssue | null {
  if (!email) return "emailRequired";
  return isEmail(email) ? null : "emailInvalid";
}

export type SignInInput = { email: string; password: string };
export type SignInFieldErrors = Partial<{ email: EmailIssue; password: "passwordRequired" }>;
export type SignInParse =
  { ok: true; value: SignInInput } | { ok: false; email: string; fieldErrors: SignInFieldErrors };

/** Вход: email без пробелов и в нижнем регистре, пароль — как введён. */
export function parseSignIn(formData: FormData): SignInParse {
  const email = normalizeEmail(readText(formData, "email") ?? "");
  const password = readText(formData, "password") ?? "";
  const fieldErrors: SignInFieldErrors = {};
  const issue = emailIssue(email);
  if (issue) fieldErrors.email = issue;
  if (!password) fieldErrors.password = "passwordRequired";
  if (fieldErrors.email || fieldErrors.password) return { ok: false, email, fieldErrors };
  return { ok: true, value: { email, password } };
}

export type StaffInput = { fullName: string; email: string; role: StaffRole };
export type StaffFieldIssue = EmailIssue | "fullNameRequired" | "fullNameTooLong" | "roleInvalid";
export type StaffFieldErrors = Partial<Record<"fullName" | "email" | "role", StaffFieldIssue>>;
export type StaffFields = { fullName: string; email: string; role: string };
export type StaffParse =
  | { ok: true; value: StaffInput }
  | { ok: false; fields: StaffFields; fieldErrors: StaffFieldErrors };

function fullNameIssue(fullName: string): StaffFieldIssue | null {
  if (!fullName) return "fullNameRequired";
  return fullName.length > STAFF_LIMITS.fullNameMax ? "fullNameTooLong" : null;
}

/** «Добавить сотрудника»: имя без лишних пробелов, email, роль — только из трёх. */
export function parseStaffInput(formData: FormData): StaffParse {
  const fields: StaffFields = {
    fullName: (readText(formData, "fullName") ?? "").trim().replace(/\s+/g, " "),
    email: normalizeEmail(readText(formData, "email") ?? ""),
    role: readText(formData, "role") ?? "",
  };
  const fieldErrors: StaffFieldErrors = {};
  const nameIssue = fullNameIssue(fields.fullName);
  if (nameIssue) fieldErrors.fullName = nameIssue;
  const mailIssue = emailIssue(fields.email);
  if (mailIssue) fieldErrors.email = mailIssue;
  if (!isStaffRole(fields.role)) fieldErrors.role = "roleInvalid";
  if (Object.keys(fieldErrors).length > 0 || !isStaffRole(fields.role))
    return { ok: false, fields, fieldErrors };
  return { ok: true, value: { fullName: fields.fullName, email: fields.email, role: fields.role } };
}

/** uuid из скрытого поля (id сотрудника, застройщика): только uuid, иначе null. */
export function readUuid(formData: FormData, name: string = "id"): string | null {
  const id = readText(formData, name);
  return id && UUID_PATTERN.test(id) ? id.toLowerCase() : null;
}

export function readStaffId(formData: FormData): string | null {
  return readUuid(formData);
}

/** Смена пароля: три поля как введены — проверяет lib/admin/password.ts. */
export function parsePasswordChange(formData: FormData): Record<PasswordField, string> {
  return {
    current: readText(formData, "current") ?? "",
    password: readText(formData, "password") ?? "",
    confirm: readText(formData, "confirm") ?? "",
  };
}
