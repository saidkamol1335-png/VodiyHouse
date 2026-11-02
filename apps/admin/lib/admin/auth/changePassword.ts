import type { StaffRole } from "../access";
import { passwordErrorCode, type AuthErrorLike, type PasswordErrorCode } from "../authErrors";
import { landingPath } from "../nav";
import { checkNewPassword, type PasswordField } from "../password";

// Первая смена пароля (/admin/parol) без Next.js и Supabase — зависимости подставляются.

export type ChangePasswordDeps = {
  /** Временный пароль проверяется отдельным входом без сохранения сессии. */
  /** captchaToken — Turnstile формы (lib/captcha.ts): проверка временного пароля — тоже вход в Auth. */
  verifyCurrentPassword(email: string, password: string, captchaToken?: string): Promise<"ok" | "wrong" | { error: AuthErrorLike }>;
  /** Новый пароль — сессией самого сотрудника. null — успех. */
  updatePassword(password: string): Promise<AuthErrorLike | null>;
  /** Снять флаг смены пароля (сервер, ключ service_role); false — строка не изменилась. */
  clearMustChange(userId: string): Promise<boolean>;
  /** Закрыть остальные сессии сотрудника. Не бросает. */
  signOutOthers(): Promise<void>;
};

export type ChangePasswordInput = {
  captchaToken?: string;
  userId: string;
  email: string;
  role: StaffRole;
  current: string;
  password: string;
  confirm: string;
};

export type PasswordFieldErrors = Partial<Record<PasswordField, PasswordErrorCode>>;

export type ChangePasswordOutcome =
  | { kind: "redirect"; to: string }
  | { kind: "error"; code: PasswordErrorCode | null; fieldErrors: PasswordFieldErrors };

const fieldError = (field: PasswordField, code: PasswordErrorCode): ChangePasswordOutcome => ({
  kind: "error",
  code: null,
  fieldErrors: { [field]: code },
});

const formError = (code: PasswordErrorCode): ChangePasswordOutcome => ({ kind: "error", code, fieldErrors: {} });

/**
 * Порядок: проверка полей → временный пароль → новый пароль → флаг → остальные сессии.
 * Временный пароль спрашиваем, чтобы старая сессия после «Новый пароль» не сменила пароль за сотрудника.
 */
export async function changeFirstPassword(deps: ChangePasswordDeps, input: ChangePasswordInput): Promise<ChangePasswordOutcome> {
  const issues = checkNewPassword(input);
  if (Object.keys(issues).length > 0) return { kind: "error", code: null, fieldErrors: issues };

  const verified = await deps.verifyCurrentPassword(input.email, input.current, input.captchaToken);
  if (verified === "wrong") return fieldError("current", "currentWrong");
  if (verified !== "ok") return formError(passwordErrorCode(verified.error));

  const updateError = await deps.updatePassword(input.password);
  if (updateError) {
    const code = passwordErrorCode(updateError);
    return code === "sameAsCurrent" || code === "weakPassword" ? fieldError("password", code) : formError(code);
  }
  if (!(await deps.clearMustChange(input.userId))) return formError("finishFailed");
  await deps.signOutOthers();
  return { kind: "redirect", to: landingPath(input.role) };
}
