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

const BASE = "/admin/zhk/1";

describe("ЖК по ролям (Н2)", () => {
  it("руководитель: создание, статус и все вкладки; строка списка — «Основное»", () => {
    const head = complexAccess("head");
    expect(head.manage).toBe(true);
    expect(head.tabs).toEqual(COMPLEX_TABS.map((tab) => tab.key));
    expect(complexTabHref(BASE, head.tabs[0]!)).toBe(BASE);
    for (const tab of COMPLEX_TABS) expect(complexTabRedirect("head", BASE, tab.key)).toBeNull();
  });

  it("менеджер: без создания и статусов, только «Квартиры»; другие вкладки — туда же", () => {
    const manager = complexAccess("manager");
    expect(manager).toEqual({ manage: false, tabs: ["units"] });
    expect(complexTabRedirect("manager", BASE, "units")).toBeNull();
    for (const key of ["main", "blocks", "layouts", "photos", "videos", "details", "documents", "preview", "log"] as const) {
      expect(complexTabRedirect("manager", BASE, key)).toBe(`${BASE}/kvartiry`);
    }
  });

  it("архивный ЖК — только руководителю: менеджеру его нет ни в списке, ни по ссылке", () => {
    for (const status of ["draft", "published", "hidden"] as const) {
      expect(canOpenComplex(complexAccess("manager"), status)).toBe(true);
    }
    expect(canOpenComplex(complexAccess("manager"), "archived")).toBe(false);
    expect(canOpenComplex(complexAccess("head"), "archived")).toBe(true);
  });

  it("мастер (3.6): у черновика шаги с номером до «Предпросмотра», «Журнал» — без номера; «Далее» — по порядку", () => {
    const labels = complexTabs(BASE, (key) => key, new Set(), true).map((tab) => tab.label);
    expect(labels).toEqual(["1. main", "2. blocks", "3. layouts", "4. units", "5. photos", "6. videos", "7. details", "8. documents", "9. preview", "log"]);
    expect(complexTabs(BASE, (key) => key).map((tab) => tab.label)[0]).toBe("main");
    const steps = wizardSteps(BASE, (key, step) => `${step}:${key}`);
    expect(steps.map((step) => step.next)).toEqual(WIZARD_STEPS.map((key, index) => `${index + 1}:${key}`));
    expect(steps.at(-1)).toEqual({ segment: "predprosmotr", href: `${BASE}/predprosmotr`, next: "9:preview" });
  });

  it("видеограф: вкладок нет — перекидывать некуда (раздел ему закрыт целиком)", () => {
    expect(complexAccess("videographer")).toEqual({ manage: false, tabs: [] });
    expect(complexTabRedirect("videographer", BASE, "units")).toBeNull();
  });
});
