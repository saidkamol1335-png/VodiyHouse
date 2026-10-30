import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HEAD_BOOT_SCRIPT } from "./headScript";
import { PRELOADER_ATTRIBUTE } from "./preloader";

function runBootScript({ search = "", reduced = false, path = "/uz" } = {}) {
  window.history.replaceState(null, "", `${path}${search}`);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" && reduced,
  }));
  new Function(HEAD_BOOT_SCRIPT)();
  return document.documentElement;
}

describe("HEAD_BOOT_SCRIPT", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE);
    document.documentElement.removeAttribute("data-anchor-start");
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

  it("?motion=none глушит анимации до отрисовки, сохранённый full не мешает", () => {
    localStorage.setItem("vh-motion", "full");
    expect(runBootScript({ search: "?motion=none" }).getAttribute("data-motion")).toBe("none");
  });

  it("reduced-motion — none поверх сохранённого full", () => {
    localStorage.setItem("vh-motion", "full");
    expect(runBootScript({ reduced: true }).getAttribute("data-motion")).toBe("none");
  });

  it("экран загрузки: первая страница сессии — главная на любом языке, один раз", () => {
    expect(runBootScript({ path: "/ru" }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(true);
    document.documentElement.removeAttribute(PRELOADER_ATTRIBUTE);
    expect(runBootScript({ path: "/ru" }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(false);
  });

  it("экран загрузки: вход с другой страницы — не появится и на главной", () => {
    expect(runBootScript({ path: "/uz/novostroyki" }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(
      false,
    );
    expect(runBootScript({ path: "/uz" }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(false);
  });

  it("экран загрузки: нет при #якоре и reduced-motion", () => {
    expect(runBootScript({ search: "#podbor" }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(false);
    sessionStorage.clear();
    document.documentElement.removeAttribute("data-anchor-start");
    expect(runBootScript({ reduced: true }).hasAttribute(PRELOADER_ATTRIBUTE)).toBe(false);
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

describe("HEAD_BOOT_SCRIPT · шапка над прокрученной страницей", () => {
  const run = (type: string, scrollY: string | null) => {
    document.documentElement.removeAttribute("data-anchor-start");
    window.history.replaceState(null, "", "/ru/novostroyki");
    sessionStorage.clear();
    if (scrollY !== null) sessionStorage.setItem("vh:scrollY:/ru/novostroyki", scrollY);
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type } as unknown as PerformanceEntry,
    ]);
    new Function(HEAD_BOOT_SCRIPT)();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    return document.documentElement.hasAttribute("data-anchor-start");
  };

  it("перезагрузка и «Назад» ниже первого экрана — метка до гидратации; сверху или новый переход — нет", () => {
    expect(run("reload", "1800")).toBe(true);
    expect(run("back_forward", "640")).toBe(true);
    expect(run("reload", "0")).toBe(false);
    expect(run("reload", null)).toBe(false);
    expect(run("navigate", "1800")).toBe(false);
    window.history.replaceState(null, "", "/");
  });
});
