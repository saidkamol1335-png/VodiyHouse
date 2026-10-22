import { describe, expect, it } from "vitest";
import { adminGate, hasAuthCookie, isAdminPath } from "./gate";

describe("ранняя проверка кабинета (proxy)", () => {
  it("кабинет — /admin и всё под ним; /administrator, /uz/admin и /dev — нет", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/nastroyki")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/uz/admin")).toBe(false);
    expect(isAdminPath("/dev/staff")).toBe(false);
  });

  it("без сессии раздел кабинета → экран входа", () => {
    expect(
      adminGate({ pathname: "/admin/nastroyki", hasSession: false, isServerAction: false }),
    ).toEqual({
      kind: "redirect",
      location: "/admin/vhod",
    });
    expect(
      adminGate({ pathname: "/admin/parol", hasSession: false, isServerAction: false }).kind,
    ).toBe("redirect");
  });

  it("экран входа открыт всегда; Server Action не перенаправляется; с сессией — пропуск", () => {
    expect(
      adminGate({ pathname: "/admin/vhod", hasSession: false, isServerAction: false }),
    ).toEqual({ kind: "next" });
    expect(adminGate({ pathname: "/admin", hasSession: false, isServerAction: true })).toEqual({
      kind: "next",
    });
    expect(adminGate({ pathname: "/admin", hasSession: true, isServerAction: false })).toEqual({
      kind: "next",
    });
  });

  it("cookie сессии Supabase: целая и по частям — да; code-verifier и язык — нет", () => {
    expect(hasAuthCookie(["NEXT_LOCALE", "sb-abcd-auth-token"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token.0", "sb-abcd-auth-token.1"])).toBe(true);
    expect(hasAuthCookie(["sb-abcd-auth-token-code-verifier"])).toBe(false);
    expect(hasAuthCookie(["NEXT_LOCALE"])).toBe(false);
    expect(hasAuthCookie([])).toBe(false);
  });
});
