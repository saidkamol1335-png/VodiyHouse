import type { SignInErrorCode } from "../authErrors";
import type { SignInFieldErrors } from "../credentials";

// Состояния форм входа — отдельно от "use server" файлов: там можно экспортировать только функции.

/** Пароля в состоянии нет: React отправляет прошлое состояние обратно на сервер. */
export type SignInState = { email: string; error: SignInErrorCode | null; fieldErrors: SignInFieldErrors };

export const SIGN_IN_IDLE: SignInState = { email: "", error: null, fieldErrors: {} };

export type SignInAction = (state: SignInState, formData: FormData) => Promise<SignInState>;
