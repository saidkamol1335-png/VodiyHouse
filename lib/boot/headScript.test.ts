import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEAD_BOOT_SCRIPT } from "./headScript";

function runBootScript({ search = "", reduced = false } = {}) {
  window.history.replaceState(null, "", `/uz${search}`);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
  }));
  new Function(HEAD_BOOT_SCRIPT)();
  return document.documentElement;
}

describe("HEAD_BOOT_SCRIPT", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-motion", "lite");
  });
  afterEach(() => vi.unstubAllGlobals());

  it("без сохранённого выбора — светлая тема и lite (как отрендерил сервер)", () => {
    const html = runBootScript();
    expect(html.getAttribute("data-theme")).toBe("light");
    expect(html.getAttribute("data-motion")).toBe("lite");
  });

  it("сохранённая тёмная тема ставится до отрисовки", () => {
    localStorage.setItem("vh-theme", "dark");
    expect(runBootScript().getAttribute("data-theme")).toBe("dark");
  });

  it("сохранённый full и ?motion=lite — побеждает параметр", () => {
    localStorage.setItem("vh-motion", "full");
    expect(runBootScript({ search: "?motion=lite" }).getAttribute("data-motion")).toBe("lite");
  });

  it("reduced-motion — none поверх сохранённого full", () => {
    localStorage.setItem("vh-motion", "full");
    expect(runBootScript({ reduced: true }).getAttribute("data-motion")).toBe("none");
  });

  it("мусор в хранилище не ломает атрибуты", () => {
    localStorage.setItem("vh-theme", "purple");
    localStorage.setItem("vh-motion", "turbo");
    const html = runBootScript();
    expect(html.getAttribute("data-theme")).toBe("light");
    expect(html.getAttribute("data-motion")).toBe("lite");
  });
});

describe("HEAD_BOOT_SCRIPT · ссылка на каталог с фильтром", () => {
  it("выдача ждёт фильтр только на /novostroyki с его параметрами", () => {
    const run = (url: string) => {
      document.documentElement.removeAttribute("data-catalog-pending");
      window.history.replaceState(null, "", url);
      new Function(HEAD_BOOT_SCRIPT)();
      return document.documentElement.hasAttribute("data-catalog-pending");
    };
    expect(run("/ru/novostroyki?komnat=2")).toBe(true);
    expect(run("/ru/novostroyki")).toBe(false);
    expect(run("/ru/kalkulyator?komnat=2")).toBe(false);
    window.history.replaceState(null, "", "/");
  });
});
