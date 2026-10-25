import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthWeakPasswordError } from "@supabase/supabase-js";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import {
  PASSWORD_ERRORS,
  passwordErrorCode,
  SIGN_IN_ERRORS,
  signInErrorCode,
  STAFF_ERRORS,
  staffAuthErrorCode,
  staffDbErrorCode,
} from "./authErrors";
import { leadDbErrorCode } from "@/lib/leads/errors";
import { CONTENT_ERRORS, contentDbErrorCode } from "./developers/errors";

const api = (code: string, status = 400) => new AuthApiError("текст Supabase", status, code);

describe("ошибки входа", () => {
  it("неверный пароль и отключённый (бан) — одна фраза", () => {
    expect(signInErrorCode(api("invalid_credentials"))).toBe("invalidCredentials");
    expect(signInErrorCode(api("user_banned"))).toBe("invalidCredentials");
    expect(signInErrorCode(api("validation_failed"))).toBe("invalidCredentials");
  });

  it("лимит попыток, сеть, вход по email выключен, прочее", () => {
    expect(signInErrorCode(api("over_request_rate_limit", 429))).toBe("rateLimited");
    expect(signInErrorCode({ status: 429 })).toBe("rateLimited");
    expect(signInErrorCode(new AuthRetryableFetchError("сбой", 503))).toBe("network");
    expect(signInErrorCode(api("email_provider_disabled"))).toBe("notConfigured");
    expect(signInErrorCode(api("unexpected_failure", 500))).toBe("unknown");
  });
});

describe("ошибки смены пароля", () => {
  it("тот же пароль, слабый, нет сессии, лимит, сеть, прочее", () => {
    expect(passwordErrorCode(api("same_password", 422))).toBe("sameAsCurrent");
    expect(passwordErrorCode(new AuthWeakPasswordError("коротко", 422, ["length"]))).toBe("weakPassword");
    expect(passwordErrorCode(new AuthSessionMissingError())).toBe("session");
    expect(passwordErrorCode(api("session_not_found", 403))).toBe("session");
    expect(passwordErrorCode(api("over_request_rate_limit", 429))).toBe("rateLimited");
    expect(passwordErrorCode(new AuthRetryableFetchError("сбой", 0))).toBe("network");
    expect(passwordErrorCode(api("unexpected_failure", 500))).toBe("unknown");
  });
});

describe("ошибки «Сотрудников»", () => {
  it("Auth: email занят, неверный email, сеть, прочее", () => {
    expect(staffAuthErrorCode(api("email_exists", 422))).toBe("emailTaken");
    expect(staffAuthErrorCode(api("user_already_exists", 422))).toBe("emailTaken");
    expect(staffAuthErrorCode(api("email_address_invalid"))).toBe("emailInvalid");
    expect(staffAuthErrorCode(new AuthRetryableFetchError("сбой", 503))).toBe("network");
    expect(staffAuthErrorCode(api("unexpected_failure", 500))).toBe("createFailed");
  });

  it("база: hint vh:* важнее кода; коды Postgres — запасной путь", () => {
    expect(staffDbErrorCode({ code: "42501", hint: "vh:self" })).toBe("self");
    expect(staffDbErrorCode({ code: "23514", hint: "vh:last_head" })).toBe("lastHead");
    expect(staffDbErrorCode({ code: "P0002", hint: "vh:not_found" })).toBe("notFound");
    expect(staffDbErrorCode({ code: "42501", hint: "vh:forbidden" })).toBe("forbidden");
    expect(staffDbErrorCode({ code: "P0002" })).toBe("notFound");
    expect(staffDbErrorCode({ code: "42501", hint: null })).toBe("forbidden");
    expect(staffDbErrorCode({ code: "XX000" })).toBe("unknown");
  });
});

describe("у каждого кода есть текст в messages/ru.json", () => {
  const cases: [string, readonly string[], Record<string, string>][] = [
    ["admin.login.errors", SIGN_IN_ERRORS, ru.admin.login.errors],
    ["admin.password.errors", PASSWORD_ERRORS, ru.admin.password.errors],
    ["admin.staff.errors", STAFF_ERRORS, ru.admin.staff.errors],
    ["admin.developers.errors", CONTENT_ERRORS, ru.admin.developers.errors],
  ];
  for (const [namespace, codes, texts] of cases) {
    it(namespace, () => {
      for (const code of codes) expect(texts[code]?.trim(), `${namespace}.${code}`).toBeTruthy();
      expect(Object.keys(texts).sort()).toEqual([...codes].sort());
    });
  }
});

// Новая миграция с новым отказом без сопоставления показала бы «Не получилось сохранить».
// Отказы заявок с сайта (лимит частоты) знает форма сайта — leadDbErrorCode.
describe("каждый hint vh:… из миграций знает кабинет или форма заявки", () => {
  const dir = path.join("supabase", "migrations");
  const hints = new Set(
    readdirSync(dir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => [...readFileSync(path.join(dir, file), "utf8").matchAll(/hint = '(vh:[a-z_0-9]+)'/g)])
      .map((match) => match[1]!),
  );

  it.each([...hints].sort())("%s", (hint) => {
    const known =
      contentDbErrorCode({ code: "XX000", hint }) !== "unknown" ||
      staffDbErrorCode({ code: "XX000", hint }) !== "unknown" ||
      leadDbErrorCode({ code: "XX000", hint }) !== "unknown";
    expect(known).toBe(true);
  });
});
