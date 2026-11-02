import { describe, expect, it } from "vitest";
import { localeOfPath, localeRedirectTarget } from "./localeRedirect";

describe("localeRedirectTarget", () => {
  it("/ без cookie — на /uz (язык по умолчанию)", () => {
    expect(localeRedirectTarget("/", undefined)).toBe("/uz");
  });

  it("/ с выбранным раньше русским — на /ru", () => {
    expect(localeRedirectTarget("/", "ru")).toBe("/ru");
  });

  it("мусор в cookie — язык по умолчанию", () => {
    expect(localeRedirectTarget("/", "en")).toBe("/uz");
  });

  it("путь без языка получает префикс", () => {
    expect(localeRedirectTarget("/novostroyki/shodlik", "ru")).toBe("/ru/novostroyki/shodlik");
  });

  it.each(["/uz", "/ru/novostroyki", "/admin", "/admin/leads", "/dev/preview", "/api/leads", "/robots.txt"])(
    "не трогаем %s",
    (path) => {
      expect(localeRedirectTarget(path, undefined)).toBeNull();
    },
  );
});

describe("localeOfPath", () => {
  it("достаёт язык из первого сегмента", () => {
    expect(localeOfPath("/ru/novostroyki")).toBe("ru");
    expect(localeOfPath("/uz")).toBe("uz");
    expect(localeOfPath("/admin")).toBeNull();
  });
});
