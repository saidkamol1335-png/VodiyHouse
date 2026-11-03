import { describe, expect, it } from "vitest";
import {
  COMPLEX_TABS,
  canOpenComplex,
  complexAccess,
  complexTabHref,
  complexTabRedirect,
  complexTabs,
  WIZARD_STEPS,
  wizardSteps,
} from "./tabs";

const BASE = "/zhk/1";

describe("ЖК по ролям (PLAN §10, п. 6)", () => {
  it("руководитель: правит и публикует, все вкладки; строка списка — «Основное»", () => {
    const head = complexAccess("head");
    expect(head).toMatchObject({ manage: true, publish: true });
    expect(head.tabs).toEqual(COMPLEX_TABS.map((tab) => tab.key));
    expect(complexTabHref(BASE, head.tabs[0]!)).toBe(BASE);
    for (const tab of COMPLEX_TABS) expect(complexTabRedirect("head", BASE, tab.key)).toBeNull();
  });

  it("менеджер: те же вкладки и квартиры, но без публикации", () => {
    const manager = complexAccess("manager");
    expect(manager).toMatchObject({ manage: true, publish: false });
    expect(manager.tabs).toEqual(COMPLEX_TABS.map((tab) => tab.key));
    for (const key of [...manager.tabs, "units", "facade"] as const) {
      expect(complexTabRedirect("manager", BASE, key)).toBeNull();
    }
  });

  it("экран 3: восемь вкладок по описанию заказчика, квартиры и фасад — свой экран", () => {
    expect(COMPLEX_TABS.map((tab) => tab.segment)).toEqual([
      null, "o-zhk", "bloki", "planirovki", "foto", "raspolozhenie", "dokumenty", "publikatsiya",
    ]);
    expect(complexTabHref(BASE, "units")).toBe(`${BASE}/kvartiry`);
    expect(complexTabHref(BASE, "facade")).toBe(`${BASE}/fasad`);
  });

  it("архивный ЖК — только руководителю: менеджеру его нет ни в списке, ни по ссылке", () => {
    for (const status of ["draft", "published", "hidden"] as const) {
      expect(canOpenComplex(complexAccess("manager"), status)).toBe(true);
    }
    expect(canOpenComplex(complexAccess("manager"), "archived")).toBe(false);
    expect(canOpenComplex(complexAccess("head"), "archived")).toBe(true);
    expect(canOpenComplex(complexAccess("mobilographer"), "draft")).toBe(false);
  });

  it("мастер: у черновика все восемь вкладок — шаги с номером, последний — «Публикация»", () => {
    const labels = complexTabs(BASE, (key) => key, new Set(), true).map((tab) => tab.label);
    expect(labels).toEqual(["1. main", "2. about", "3. blocks", "4. layouts", "5. photos", "6. location", "7. documents", "8. publication"]);
    expect(complexTabs(BASE, (key) => key).map((tab) => tab.label)[0]).toBe("main");
    const steps = wizardSteps(BASE, (key, step) => `${step}:${key}`);
    expect(steps.map((step) => step.next)).toEqual(WIZARD_STEPS.map((key, index) => `${index + 1}:${key}`));
    expect(steps.at(-1)).toEqual({ segment: "publikatsiya", href: `${BASE}/publikatsiya`, next: "8:publication" });
  });

  it("мобилограф: вкладок нет — перекидывать некуда (раздел ему закрыт целиком)", () => {
    expect(complexAccess("mobilographer")).toEqual({ manage: false, publish: false, tabs: [] });
    expect(complexTabRedirect("mobilographer", BASE, "units")).toBeNull();
  });
});
