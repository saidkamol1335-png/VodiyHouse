// Ошибки входа, смены пароля и «Сотрудников» → коды для messages/ru.json.
// Сопоставляем по code, name и hint, а не по тексту: текст Supabase может смениться.
// Без импорта SDK: модуль подключают и клиентские формы (ради типов кодов).

export const SIGN_IN_ERRORS = [
  "emailRequired",
  "emailInvalid",
  "passwordRequired",
  "invalidCredentials",
  "noAccess",
  "rateLimited",
  "network",
  "notConfigured",
  "unknown",
] as const;

export const PASSWORD_ERRORS = [
  "currentRequired",
  "currentWrong",
  "tooShort",
  "tooLong",
  "mismatch",
  "sameAsCurrent",
  "weakPassword",
  "session",
  "rateLimited",
  "network",
  "finishFailed",
  "notConfigured",
  "unknown",
] as const;

export const STAFF_ERRORS = [
  "fullNameRequired",
  "fullNameTooLong",
  "emailRequired",
  "emailInvalid",
  "roleInvalid",
  "emailTaken",
  "self",
  "lastHead",
  "notFound",
  "forbidden",
  "session",
  "banFailed",
  "unbanFailed",
  "createFailed",
  "resetFailed",
  "network",
  "notConfigured",
  "unknown",
] as const;

export type SignInErrorCode = (typeof SIGN_IN_ERRORS)[number];
export type PasswordErrorCode = (typeof PASSWORD_ERRORS)[number];
export type StaffErrorCode = (typeof STAFF_ERRORS)[number];

/** Достаточно полей AuthError из @supabase/supabase-js. */
export type AuthErrorLike = { code?: string; status?: number; name?: string };
/** Ошибка Postgres через PostgREST или pg: hint 'vh:…' ставят наши функции и триггеры. */
export type DbErrorLike = { code?: string; hint?: string | null };

const isNetwork = (error: AuthErrorLike) => error.name === "AuthRetryableFetchError";
const isRateLimited = (error: AuthErrorLike) =>
  error.code === "over_request_rate_limit" || error.status === 429;

// Отключённый (бан) и неверный пароль — одна фраза: по ответу нельзя узнать, кто отключён.
const SIGN_IN_BY_CODE: Record<string, SignInErrorCode> = {
  invalid_credentials: "invalidCredentials",
  user_banned: "invalidCredentials",
  validation_failed: "invalidCredentials",
  email_provider_disabled: "notConfigured",
  email_not_confirmed: "notConfigured",
};

export function signInErrorCode(error: AuthErrorLike): SignInErrorCode {
  if (isRateLimited(error)) return "rateLimited";
  if (isNetwork(error)) return "network";
  return SIGN_IN_BY_CODE[error.code ?? ""] ?? "unknown";
}

export function passwordErrorCode(error: AuthErrorLike): PasswordErrorCode {
  if (error.code === "same_password") return "sameAsCurrent";
  if (error.code === "weak_password" || error.name === "AuthWeakPasswordError")
    return "weakPassword";
  if (error.code === "session_not_found" || error.name === "AuthSessionMissingError")
    return "session";
  if (isRateLimited(error)) return "rateLimited";
  if (isNetwork(error)) return "network";
  return "unknown";
}

/** Ошибки Auth Admin API при создании сотрудника. */
export function staffAuthErrorCode(error: AuthErrorLike): StaffErrorCode {
  if (error.code === "email_exists" || error.code === "user_already_exists") return "emailTaken";
  if (error.code === "email_address_invalid") return "emailInvalid";
  if (isNetwork(error)) return "network";
  return "createFailed";
}

const STAFF_BY_HINT: Record<string, StaffErrorCode> = {
  "vh:self": "self",
  "vh:last_head": "lastHead",
  "vh:not_found": "notFound",
  "vh:forbidden": "forbidden",
};

/** Отказы базы: свои — по hint; no_data_found и insufficient_privilege — по коду Postgres. */
export function staffDbErrorCode(error: DbErrorLike): StaffErrorCode {
  const byHint = STAFF_BY_HINT[error.hint ?? ""];
  if (byHint) return byHint;
  if (error.code === "P0002") return "notFound";
  if (error.code === "42501") return "forbidden";
  return "unknown";
}
