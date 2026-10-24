import { describe, expect, it } from "vitest";
import { DEMO_PANEL_RECORDS } from "../programs/demo";
import { demoSiteCalc } from "./siteDemo";

// Стенд /dev/kalkulyator получает данные в виде ответа site_calc_screen() (шаг 2.6): ни полей и
// значений скидки, ни текста «Условия для клиента» — как у private.site_program (PLAN §3.13).
// HTML стенда для этой проверки не годится: стенды /dev получают все тексты кабинета.

describe("DEMO калькулятора сайта", () => {
  it.each(DEMO_PANEL_RECORDS.map((panel) => panel.slug))("%s: без скидок и условий", (slug) => {
    const text = JSON.stringify(demoSiteCalc(slug));
    expect(text).not.toMatch(/discount|скидк|chegirma/i);
    expect(text).not.toMatch(/"conditions"/);
  });
});
