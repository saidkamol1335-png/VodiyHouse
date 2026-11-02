import { describe, expect, it } from "vitest";
import { findFiction, findZeroCounts } from "./fiction";

const rules = (text: string, phones?: string[]) =>
  findFiction(text, phones).map((hit) => `${hit.rule}: ${hit.match}`);

describe("findFiction", () => {
  it("названия мокапа и DEMO, пометки и слаги demo-", () => {
    expect(rules("ЖК Namuna от Marg‘ilon Invest")).toEqual([
      "название из мокапа или DEMO: Namuna",
      "название из мокапа или DEMO: Marg‘ilon Invest",
    ]);
    expect(rules('<a href="/ru/novostroyki/demo-orzu">DEMO</a> TODO-заказчик')).toEqual([
      "заглушка: DEMO",
      "заглушка: TODO",
      "заглушка: /demo-o",
    ]);
  });

  it("слово внутри другого слова — не находка; настоящий Shodlik — тоже", () => {
    expect(rules("Namunaviy hujjat, Orzular, ЖК Shodlik, Sayilgoh")).toEqual([]);
  });

  it("телефоны: чужой — находка, номер Vodiy House из настроек — нет", () => {
    expect(rules("Звоните +998 90 123 45 67")).toEqual(["телефон: +998 90 123 45 67"]);
    expect(rules("Звоните +998 (90) 123-45-67", ["+998901234567"])).toEqual([]);
    expect(rules("координаты 40.380421, 71.780458 и код 1793640487884")).toEqual([]);
  });
});

describe("findZeroCounts", () => {
  it("нули вместо данных", () => {
    expect(findZeroCounts("0 жилых комплексов").map((hit) => hit.match)).toEqual(["0 жил"]);
    expect(findZeroCounts("Найдено 0 ЖК").length).toBeGreaterThan(0);
    expect(findZeroCounts("saytda 0 ta quruvchi").length).toBeGreaterThan(0);
  });

  it("цены, сроки и проценты с нулём — не находка", () => {
    expect(findZeroCounts("от $45 000 · 10 квартир · 0% наценки · 100 ЖК · 0 сум")).toEqual([]);
  });
});
