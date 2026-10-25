import { afterEach, describe, expect, it, vi } from "vitest";

// Источник захода (ТЗ 10.3): метки со старого адреса ЖК, который ответил редиректом на каталог без
// параметров, берутся из cookie proxy (3.13, ревью блока F) — один раз и только со своего сайта.

async function load() {
  vi.resetModules();
  return import("./source");
}

describe("источник захода", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.cookie = "vh-landing=; max-age=0; path=/";
  });

  it("редирект со старого адреса ЖК: метки из cookie, cookie стирается", async () => {
    document.cookie = `vh-landing=${encodeURIComponent("/ru/novostroyki/staryy?utm_source=instagram&gclid=abc")}; path=/`;
    const { rememberVisitSource, leadSource } = await load();
    rememberVisitSource("http://localhost:3000/ru/novostroyki", "");
    expect(leadSource()).toMatchObject({ utm_source: "instagram", gclid: "abc", landing: "/ru/novostroyki/staryy" });
    expect(document.cookie).not.toContain("vh-landing=");
  });

  it("метки в адресе страницы важнее cookie; чужой сайт в cookie не принимается", async () => {
    document.cookie = `vh-landing=${encodeURIComponent("https://evil.example/?utm_source=evil")}; path=/`;
    const { rememberVisitSource, leadSource } = await load();
    rememberVisitSource("http://localhost:3000/ru", "");
    expect(leadSource().utm_source).toBeUndefined();
    window.localStorage.clear();
    const fresh = await load();
    fresh.rememberVisitSource("http://localhost:3000/ru?utm_source=telegram", "");
    expect(fresh.leadSource().utm_source).toBe("telegram");
  });
});
