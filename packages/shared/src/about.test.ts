import { describe, expect, it } from "vitest";
import { aboutHistoryFrom, aboutTeamFrom } from "./about";

describe("«О компании» (правки 15.11, п. 25)", () => {
  const title = { ru: "Открыли офис", uz: "Ofis ochdik" };

  it("история — по году, неполные события пропущены", () => {
    expect(aboutHistoryFrom([{ year: 2024, title, text: null }, { year: 2019, title, text: { ru: "Текст", uz: "Matn" } }, { year: "2020", title }, { year: 2021, title: { ru: "x", uz: "" } }])).toEqual([
      { year: 2019, title, text: { ru: "Текст", uz: "Matn" } },
      { year: 2024, title, text: null },
    ]);
  });

  it("команда — в порядке записи; без согласия, имени или должности — не на сайт", () => {
    const person = { id: "a", name: " Азиз ", position: { ru: "Менеджер", uz: "Menejer" }, photo: { path: "team/a/b.jpg", width: 10, height: 20 }, consent_at: "2026-11-17" };
    expect(aboutTeamFrom([person, { ...person, id: "b", consent_at: undefined }, { ...person, id: "c", name: "" }])).toEqual([
      { id: "a", name: "Азиз", position: { ru: "Менеджер", uz: "Menejer" }, photo: { path: "team/a/b.jpg", width: 10, height: 20, blur: null }, consentAt: "2026-11-17" },
    ]);
    expect(aboutTeamFrom(null)).toEqual([]);
  });
});
