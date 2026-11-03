import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV,
  ADMIN_ROUTES,
  canOpen,
  isNavItemActive,
  isSectionOpen,
  landingPath,
  readySettingsTabs,
  settingsTabRedirect,
  visibleNav,
} from "./nav";

// План целиком (PLAN §7): все разделы готовы для всех своих ролей.
const allReady = ADMIN_NAV.map((item) => ({ ...item, ready: true, readyFor: undefined }));
const keysFor = (role: Parameters<typeof visibleNav>[0]) =>
  visibleNav(role, allReady).map((item) => item.key);

describe("меню кабинета", () => {
  it("сейчас: руководитель — Главная, Заявки, ЖК, Застройщики, Витрина, Программы, Видео, Статистика, Настройки; менеджер — Главная, Заявки, ЖК, Программы, Видео (фаза 6)", () => {
    expect(visibleNav("head").map((item) => item.key)).toEqual([
      "home",
      "leads",
      "complexes",
      "developers",
      "showcase",
      "programs",
      "video",
      "stats",
      "settings",
    ]);
    expect(visibleNav("manager").map((item) => item.key)).toEqual([
      "home",
      "leads",
      "complexes",
      "programs",
      "video",
      "settings",
    ]);
    // Фаза 5 (5B): мобилограф — сразу в «Видео и ход стройки».
    expect(visibleNav("mobilographer").map((item) => item.key)).toEqual(["video"]);
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
    expect(visibleNav("manager", partly).map((item) => item.key)).toEqual([
      "home",
      "leads",
      "programs",
      "video",
      "settings",
    ]);
  });

  it("руководитель видит все 9 разделов в порядке PLAN §7 (с «Витриной» 3.16а)", () => {
    expect(keysFor("head")).toEqual([
      "home",
      "leads",
      "complexes",
      "developers",
      "showcase",
      "programs",
      "video",
      "stats",
      "settings",
    ]);
  });

  it("менеджер: заявки, ЖК, расчёт, видео и «Справочники» — без застройщиков и статистики", () => {
    expect(keysFor("manager")).toEqual(["home", "leads", "complexes", "programs", "video", "settings"]);
    expect(visibleNav("manager").find((item) => item.key === "settings")!.href).toBe(ADMIN_ROUTES.dictionaries);
  });

  it("мобилограф видит только видео", () => {
    expect(keysFor("mobilographer")).toEqual(["video"]);
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
    expect(isNavItemActive(ADMIN_ROUTES.home, "/")).toBe(true);
    expect(isNavItemActive(ADMIN_ROUTES.home, "/zayavki")).toBe(false);
    expect(isNavItemActive(ADMIN_ROUTES.leads, "/zayavki/1045")).toBe(true);
    expect(isNavItemActive(ADMIN_ROUTES.leads, "/zayavkix")).toBe(false);
  });
});

describe("доступ к разделам", () => {
  it("canOpen: настройки — руководителю и менеджеру (вкладки по роли); Главная — не мобилографу", () => {
    expect(canOpen("head", "settings")).toBe(true);
    expect(canOpen("manager", "settings")).toBe(true);
    expect(canOpen("mobilographer", "settings")).toBe(false);
    expect(canOpen("manager", "home")).toBe(true);
    expect(canOpen("mobilographer", "home")).toBe(false);
    expect(canOpen("mobilographer", "video")).toBe(true);
  });

  it("после входа — первый пункт меню роли; нет пунктов — Главная", () => {
    expect(landingPath("head")).toBe("/");
    expect(landingPath("mobilographer")).toBe(ADMIN_ROUTES.video);
    expect(landingPath("mobilographer", allReady)).toBe(ADMIN_ROUTES.video);
  });

  it("вкладки настроек (Д6): Сотрудники · Справочники · Контакты · Журнал — отдельные адреса", () => {
    expect(readySettingsTabs().map((tab) => [tab.key, tab.href, tab.segment])).toEqual([
      ["staff", "/nastroyki", null],
      ["dictionaries", "/nastroyki/spravochniki", "spravochniki"],
      ["contacts", "/nastroyki/kontakty", "kontakty"],
      ["journal", "/nastroyki/zhurnal", "zhurnal"],
    ]);
  });

  it("вкладки настроек менеджера (п. 29): только «Справочники», остальные ведут туда", () => {
    expect(readySettingsTabs("manager").map((tab) => tab.key)).toEqual(["dictionaries"]);
    for (const key of ["staff", "contacts", "journal"] as const) {
      expect(settingsTabRedirect("manager", key)).toBe("/nastroyki/spravochniki");
      expect(settingsTabRedirect("head", key)).toBeNull();
    }
    expect(settingsTabRedirect("manager", "dictionaries")).toBeNull();
  });
});
