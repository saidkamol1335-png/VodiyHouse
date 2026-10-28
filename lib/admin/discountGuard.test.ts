import { describe, expect, it } from "vitest";
import { bilingualMentionsDiscount, mentionsDiscount } from "./discountGuard";

describe("запрет «скидка» в текстах витрины (PLAN §3.13)", () => {
  it("ловит слово в любой форме и на обоих языках", () => {
    expect(mentionsDiscount("Скидка 15% при 100% оплате")).toBe(true);
    expect(mentionsDiscount("со скидкой до конца месяца")).toBe(true);
    expect(mentionsDiscount("100% to‘lovda 15% chegirma")).toBe(true);
    expect(mentionsDiscount("Discount for early buyers")).toBe(true);
  });

  it("рассрочка, подарок и старт продаж проходят", () => {
    expect(mentionsDiscount("Рассрочка на 24 месяца без наценки")).toBe(false);
    expect(mentionsDiscount("Кухонный гарнитур в подарок")).toBe(false);
    expect(mentionsDiscount("Savdo boshlanishi")).toBe(false);
  });

  it("двуязычный текст: хватает одного языка; пусто — чисто", () => {
    expect(bilingualMentionsDiscount({ ru: "Подарок", uz: "15% chegirma" })).toBe(true);
    expect(bilingualMentionsDiscount({ ru: "Подарок", uz: "Sovg‘a" })).toBe(false);
    expect(bilingualMentionsDiscount(null)).toBe(false);
  });
});
