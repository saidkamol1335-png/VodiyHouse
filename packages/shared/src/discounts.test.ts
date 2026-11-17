import { describe, expect, it } from "vitest";
import { DISCOUNTS_DEFAULT, discountSettingsFrom, mentionsDiscount, textsMentionDiscount } from "./discounts";

describe("discountSettingsFrom", () => {
  it("записи нет или она кривая — скидок на сайте нет", () => {
    expect(DISCOUNTS_DEFAULT).toEqual({ enabled: false });
    expect(discountSettingsFrom(null)).toEqual(DISCOUNTS_DEFAULT);
    expect(discountSettingsFrom({ enabled: "true" })).toEqual(DISCOUNTS_DEFAULT);
  });

  it("выключатель из записи", () => {
    expect(discountSettingsFrom({ enabled: true })).toEqual({ enabled: true });
  });
});

describe("mentionsDiscount", () => {
  it("слово «скидка» и «−N%» — скидка; диапазон и взнос — нет", () => {
    expect(mentionsDiscount("Скидка 5% до конца месяца")).toBe(true);
    expect(mentionsDiscount("Chegirma bor")).toBe(true);
    expect(mentionsDiscount("Цены −10 % на 3-комнатные")).toBe(true);
    expect(mentionsDiscount("Взнос 30%, рассрочка 10–30%")).toBe(false);
  });

  it("тексты на двух языках: хватает одного", () => {
    expect(textsMentionDiscount({ ru: "Подарок", uz: "Sovg‘a" }, { ru: "Рассрочка", uz: "10% chegirma" })).toBe(true);
    expect(textsMentionDiscount({ ru: "Подарок", uz: "Sovg‘a" }, null)).toBe(false);
  });
});
