import { describe, expect, it } from "vitest";
import { adminGate, hasAuthCookie, isAdminPath } from "./gate";

describe("ранняя проверка кабинета (proxy)", () => {
  // Проект-2 (PLAN §10): весь домен админки — кабинет, кроме стендов /dev и служебных /api.
  it("кабинет — корень и всё под ним; /dev и /api — нет", () => {
    expect(isAdminPath("/")).toBe(true);
    expect(isAdminPath("/nastroyki")).toBe(true);
    expect(isAdminPath("/developers")).toBe(true);
    expect(isAdminPath("/dev")).toBe(false);
    expect(isAdminPath("/dev/staff")).toBe(false);
    expect(isAdminPath("/api/cron/leads")).toBe(false);
  });

  it("без сессии раздел кабинета → экран входа", () => {
    expect(adminGate({ pathname: "/nastroyki", hasSession: false, isServerAction: false })).toEqual({
      kind: "redirect",
      location: "/vhod",
    });
    expect(adminGate({ pathname: "/parol", hasSession: false, isServerAction: false }).kind).toBe("redirect");
  });

  it("экран входа открыт всегда; Server Action не перенаправляется; с сессией — пропуск", () => {
    expect(adminGate({ pathname: "/vhod", hasSession: false, isServerAction: false })).toEqual({ kind: "next" });
    expect(adminGate({ pathname: "/", hasSession: false, isServerAction: true })).toEqual({ kind: "next" });
    expect(adminGate({ pathname: "/", hasSession: true, isServerAction: false })).toEqual({ kind: "next" });
  });

  it("cookie сессии Supabase: целая и по частям — да; code-verifier и язык — нет", () => {
    expect(hasAuthCookie(["NEXT_LOCALE", "sb-abcd-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token.0", "sb-abcd-auth-token.1"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token-code-verifier"])).toBe(false);
    expect(hasAuthCookie(["NEXT_LOCALE"])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });
});
