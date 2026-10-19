import { describe, expect, it } from "vitest";
import { getCabinetViewer } from "./access";
import { ADMIN_NAV, ADMIN_ROUTES, isNavItemActive, visibleNav } from "./nav";

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

describe("доступ без входа", () => {
  it("в разработке — руководитель без имени, в продакшене — никого", () => {
    expect(getCabinetViewer(true)).toEqual({ role: "head", name: null });
    expect(getCabinetViewer(false)).toBeNull();
  });
});
