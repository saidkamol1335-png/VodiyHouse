// CAPTCHA входа (Cloudflare Turnstile, «Запуск» — security-2026-10-29.md): Supabase Auth с включённой
// CAPTCHA требует токен при каждом входе по паролю — в форме входа и при проверке временного пароля
// (/admin/parol). Включается ключом сайта: без NEXT_PUBLIC_TURNSTILE_SITE_KEY виджета нет и вход как
// раньше. Порядок на «Запуске»: ключ в Netlify → выкладка → только потом CAPTCHA в Supabase Auth.
// Без импорта SDK: модуль читают и форма (браузер), и действия (сервер).

/** Поле, которое Turnstile сам добавляет в форму. */
export const CAPTCHA_FIELD = "cf-turnstile-response";
/** Ключ сайта Turnstile; пусто — CAPTCHA выключена. */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const TOKEN_MAX_LENGTH = 4096;

/** Токен из формы; нет или пустой — undefined (Supabase без CAPTCHA его не ждёт). */
export function captchaTokenOf(formData: FormData): string | undefined {
  const value = formData.get(CAPTCHA_FIELD);
  return typeof value === "string" && value.length > 0
    ? value.slice(0, TOKEN_MAX_LENGTH)
    : undefined;
}
