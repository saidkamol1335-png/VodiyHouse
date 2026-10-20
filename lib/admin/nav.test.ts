import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_ROUTES,
  canOpen,
  isNavItemActive,
  landingPath,
  readySettingsTabs,
  visibleNav,
} from "./nav";

const allReady = ADMIN_NAV.map((item) => ({ ...item, ready: true }));
const keysFor = (role: Parameters<typeof visibleNav>[0]) => visibleNav(role, allReady).map((item) => item.key);

describe("меню кабинета", () => {
  it("фаза 0: видна только «Главная»", () => {
    expect(visibleNav("head").map((item) => item.key)).toEqual(["home"]);
  });

  it("руководитель видит все 8 разделов в порядке PLAN §7", () => {
    expect(keysFor("head")).toEqual(["home", "leads", "complexes", "developers", "programs", "video", "stats", "settings"]);
  });

  it("менеджер: заявки, наличие квартир, расчёт и видео — без застройщиков, статистики, настроек", () => {
    expect(keysFor("manager")).toEqual(["home", "leads", "complexes", "programs", "video"]);
  });

  it("видеограф видит только видео", () => {
    expect(keysFor("videographer")).toEqual(["video"]);
  });

  it("активный пункт: главная — только на /admin, раздел — и на вложенных", () => {
    expect(isNavItemActive(ADMIN_ROUTES.home, "/admin")).toBe(true);
    expect(isNavItemActive(ADMIN_ROUTES.home, "/admin/zayavki")).toBe(false);
    expect(isNavItemActive(ADMIN_ROUTES.leads, "/admin/zayavki/1045")).toBe(true);
    expect(isNavItemActive(ADMIN_ROUTES.leads, "/admin/zayavkix")).toBe(false);
  });
});

describe("доступ к разделам", () => {
  it("canOpen: настройки — только руководителю; Главная — не видеографу; готовность не важна", () => {
    expect(canOpen("head", "settings")).toBe(true);
    expect(canOpen("manager", "settings")).toBe(false);
    expect(canOpen("videographer", "settings")).toBe(false);
    expect(canOpen("manager", "home")).toBe(true);
    expect(canOpen("videographer", "home")).toBe(false);
    expect(canOpen("videographer", "video")).toBe(true);
  });

  it("после входа — первый пункт меню роли; нет пунктов — Главная", () => {
    expect(landingPath("head")).toBe("/admin");
    expect(landingPath("videographer")).toBe("/admin");
    expect(landingPath("videographer", allReady)).toBe(ADMIN_ROUTES.video);
  });

  it("вкладки настроек до шага 10.2 — только «Сотрудники» по адресу /admin/nastroyki", () => {
    expect(readySettingsTabs().map((tab) => [tab.key, tab.href, tab.segment])).toEqual([
      ["staff", "/admin/nastroyki", null],
    ]);
  });
});
