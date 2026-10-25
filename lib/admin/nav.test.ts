import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_ROUTES,
  canOpen,
  isNavItemActive,
  isSectionOpen,
  landingPath,
  readySettingsTabs,
  visibleNav,
} from "./nav";

// План целиком (PLAN §7): все разделы готовы для всех своих ролей.
const allReady = ADMIN_NAV.map((item) => ({ ...item, ready: true, readyFor: undefined }));
const keysFor = (role: Parameters<typeof visibleNav>[0]) =>
  visibleNav(role, allReady).map((item) => item.key);

describe("меню кабинета", () => {
  it("сейчас: руководитель — Главная, Заявки, ЖК, Застройщики, Программы, Настройки; менеджер — Главная, Заявки, ЖК, Программы (3.7)", () => {
    expect(visibleNav("head").map((item) => item.key)).toEqual([
      "home",
      "leads",
      "complexes",
      "developers",
      "programs",
      "settings",
    ]);
    expect(visibleNav("manager").map((item) => item.key)).toEqual([
      "home",
      "leads",
      "complexes",
      "programs",
    ]);
    expect(visibleNav("videographer")).toEqual([]);
    expect(isSectionOpen("manager", "complexes")).toBe(true);
    expect(isSectionOpen("manager", "developers")).toBe(false);
  });

  it("раздел, готовый не для всех ролей: руководителю открыт, менеджеру — пока нет", () => {
    const partly = ADMIN_NAV.map((item) =>
      item.key === "complexes" ? { ...item, readyFor: ["head"] as const } : item,
    );
    expect(isSectionOpen("head", "complexes", partly)).toBe(true);
    expect(isSectionOpen("manager", "complexes", partly)).toBe(false);
    expect(isSectionOpen("manager", "home", partly)).toBe(true);
    expect(visibleNav("manager", partly).map((item) => item.key)).toEqual(["home", "leads", "programs"]);
  });

  it("руководитель видит все 8 разделов в порядке PLAN §7", () => {
    expect(keysFor("head")).toEqual([
      "home",
      "leads",
      "complexes",
      "developers",
      "programs",
      "video",
      "stats",
      "settings",
    ]);
  });

  it("менеджер: заявки, наличие квартир, расчёт и видео — без застройщиков, статистики, настроек", () => {
    expect(keysFor("manager")).toEqual(["home", "leads", "complexes", "programs", "video"]);
  });

  it("видеограф видит только видео", () => {
    expect(keysFor("videographer")).toEqual(["video"]);
  });

  it("менеджеру «Программы оплаты» открываются «Расчётом для клиента», пункт активен во всём разделе", () => {
    const managerPrograms = visibleNav("manager").find((item) => item.key === "programs")!;
    expect(managerPrograms.href).toBe(ADMIN_ROUTES.programsCalc);
    expect(managerPrograms.section).toBe(ADMIN_ROUTES.programs);
    expect(visibleNav("head").find((item) => item.key === "programs")!.href).toBe(
      ADMIN_ROUTES.programs,
    );
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

  it("вкладки настроек (Д6): Сотрудники · Справочники · Контакты · Журнал — отдельные адреса", () => {
    expect(readySettingsTabs().map((tab) => [tab.key, tab.href, tab.segment])).toEqual([
      ["staff", "/admin/nastroyki", null],
      ["dictionaries", "/admin/nastroyki/spravochniki", "spravochniki"],
      ["contacts", "/admin/nastroyki/kontakty", "kontakty"],
      ["journal", "/admin/nastroyki/zhurnal", "zhurnal"],
    ]);
  });
});
