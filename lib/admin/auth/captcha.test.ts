import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FIELD, captchaTokenOf } from "@/lib/captcha";
import { passwordErrorCode, signInErrorCode } from "../authErrors";
import { parseSignIn } from "../credentials";
import { changeFirstPassword, type ChangePasswordDeps } from "./changePassword";
import { signIn, type SignInDeps } from "./signIn";

// CAPTCHA входа (Turnstile, «Запуск»): токен из формы доходит до Supabase Auth и при входе, и при
// проверке временного пароля; без CAPTCHA — вход как раньше; отказ Auth — понятный текст.

const USER = "6f1c2c1e-6b1f-4bb0-9d7e-0d2b9f1d1a01";
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

describe("CAPTCHA входа", () => {
  it("токен — из поля Turnstile; пусто — нет токена", () => {
    expect(captchaTokenOf(form({ [CAPTCHA_FIELD]: "tok-123" }))).toBe("tok-123");
    expect(captchaTokenOf(form({ [CAPTCHA_FIELD]: "" }))).toBeUndefined();
    expect(captchaTokenOf(form({}))).toBeUndefined();
    expect(captchaTokenOf(form({ [CAPTCHA_FIELD]: "x".repeat(5000) }))?.length).toBe(4096);
  });

  it("вход: токен формы уходит в Supabase; без CAPTCHA — поля как раньше", async () => {
    const withToken = parseSignIn(
      form({ email: "Head@VodiyHouse.uz ", password: "Пароль-1", [CAPTCHA_FIELD]: "tok-1" }),
    );
    expect(withToken).toEqual({
      ok: true,
      value: { email: "head@vodiyhouse.uz", password: "Пароль-1", captchaToken: "tok-1" },
    });
    expect(parseSignIn(form({ email: "head@vodiyhouse.uz", password: "Пароль-1" }))).toEqual({
      ok: true,
      value: { email: "head@vodiyhouse.uz", password: "Пароль-1" },
    });
    const signInWithPassword = vi.fn<SignInDeps["signInWithPassword"]>(async () => ({
      error: new AuthApiError("captcha protection: request disallowed", 400, "captcha_failed"),
    }));
    const deps: SignInDeps = {
      beginAttempt: async () => true,
      clearAttempts: async () => undefined,
      signInWithPassword,
      readOwnProfile: async () => null,
      signOutLocal: async () => undefined,
    };
    if (!withToken.ok) throw new Error("parse");
    expect(await signIn(deps, withToken.value)).toEqual({ kind: "error", code: "captchaFailed" });
    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({ captchaToken: "tok-1" }),
    );
  });

  it("смена временного пароля: проверка временного — с токеном; отказ CAPTCHA — ошибка формы", async () => {
    const verifyCurrentPassword = vi.fn<ChangePasswordDeps["verifyCurrentPassword"]>(async () => ({
      error: { code: "captcha_failed", status: 400 },
    }));
    const deps: ChangePasswordDeps = {
      verifyCurrentPassword,
      updatePassword: async () => null,
      clearMustChange: async () => true,
      signOutOthers: async () => undefined,
    };
    const outcome = await changeFirstPassword(deps, {
      captchaToken: "tok-2",
      userId: USER,
      email: "manager@vodiyhouse.uz",
      role: "manager",
      current: "Временный-1",
      password: "Новый-пароль-12",
      confirm: "Новый-пароль-12",
    });
    expect(outcome).toEqual({ kind: "error", code: "captchaFailed", fieldErrors: {} });
    expect(verifyCurrentPassword).toHaveBeenCalledWith(
      "manager@vodiyhouse.uz",
      "Временный-1",
      "tok-2",
    );
  });

  it("коды Auth: captcha_failed → captchaFailed и при входе, и при смене пароля", () => {
    expect(signInErrorCode({ code: "captcha_failed", status: 400 })).toBe("captchaFailed");
    expect(passwordErrorCode({ code: "captcha_failed", status: 400 })).toBe("captchaFailed");
  });
});
