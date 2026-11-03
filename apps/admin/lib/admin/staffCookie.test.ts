import { describe, expect, it } from "vitest";
import { requestOrigin, staffCookie, staffCookieDomain, staffCookieRemoval } from "./staffCookie";

const prod = { STAFF_COOKIE_DOMAIN: ".vodiyhouse.uz" };

describe("метка браузера сотрудника (фаза F, п. 40)", () => {
  it("общий домен — только для кабинета на нём; тестовый Netlify и localhost — без домена", () => {
    expect(staffCookieDomain("admin.vodiyhouse.uz", prod)).toBe(".vodiyhouse.uz");
    expect(staffCookieDomain("ADMIN.vodiyhouse.uz", { STAFF_COOKIE_DOMAIN: "vodiyhouse.uz" })).toBe(".vodiyhouse.uz");
    expect(staffCookieDomain("vodiyhouse-admin-test.netlify.app", prod)).toBeUndefined();
    expect(staffCookieDomain("localhost", prod)).toBeUndefined();
    expect(staffCookieDomain("evilvodiyhouse.uz", prod)).toBeUndefined();
    expect(staffCookieDomain("admin.vodiyhouse.uz", { STAFF_COOKIE_DOMAIN: "" })).toBeUndefined();
  });

  it("метка: vh-staff=1 на год с запасом, путь /, Lax, читается браузером; Secure — по протоколу", () => {
    expect(staffCookie("admin.vodiyhouse.uz", true, prod)).toEqual({
      name: "vh-staff",
      value: "1",
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: true,
      maxAge: 400 * 24 * 60 * 60,
      domain: ".vodiyhouse.uz",
    });
    expect(staffCookie("localhost", false, prod)).not.toHaveProperty("domain");
    expect(staffCookie("localhost", false, prod).secure).toBe(false);
  });

  it("снятие — тот же домен, пустое значение и срок 0", () => {
    expect(staffCookieRemoval("admin.vodiyhouse.uz", true, prod)).toMatchObject({
      name: "vh-staff",
      value: "",
      maxAge: 0,
      domain: ".vodiyhouse.uz",
    });
  });

  it("хост и протокол действия — из x-forwarded-*, иначе host без порта", () => {
    expect(
      requestOrigin(new Headers({ "x-forwarded-host": "admin.vodiyhouse.uz", "x-forwarded-proto": "https" })),
    ).toEqual({ hostname: "admin.vodiyhouse.uz", https: true });
    expect(requestOrigin(new Headers({ host: "localhost:3001" }))).toEqual({ hostname: "localhost", https: false });
  });
});
