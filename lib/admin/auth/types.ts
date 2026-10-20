import type { PasswordErrorCode, SignInErrorCode } from "../authErrors";
import type { SignInFieldErrors } from "../credentials";
import type { PasswordFieldErrors } from "./changePassword";

// Состояния форм входа — отдельно от "use server" файлов: там можно экспортировать только функции.

/** Пароля в состоянии нет: React отправляет прошлое состояние обратно на сервер. */
export type SignInState = { email: string; error: SignInErrorCode | null; fieldErrors: SignInFieldErrors };

export const SIGN_IN_IDLE: SignInState = { email: "", error: null, fieldErrors: {} };

export type SignInAction = (state: SignInState, formData: FormData) => Promise<SignInState>;

/** Смена пароля: только коды — поля паролей форма после ответа очищает. */
export type PasswordState = { error: PasswordErrorCode | null; fieldErrors: PasswordFieldErrors };

export const PASSWORD_IDLE: PasswordState = { error: null, fieldErrors: {} };

export type PasswordChangeAction = (state: PasswordState, formData: FormData) => Promise<PasswordState>;
