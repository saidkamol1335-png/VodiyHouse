import { describe, expect, it } from "vitest";
import { bilingualMentionsDiscount, mentionsDiscount } from "./discountGuard";

describe("запрет «скидка» в текстах витрины (PLAN §3.13)", () => {
  it("ловит слово в любой форме и на обоих языках", () => {
    expect(mentionsDiscount("Скидка 15% при 100% оплате")).toBe(true);
    expect(mentionsDiscount("со скидкой до конца месяца")).toBe(true);
    expect(mentionsDiscount("100% to‘lovda 15% chegirma")).toBe(true);
    expect(mentionsDiscount("Discount for early buyers")).toBe(true);
  });

  it("«−N%» — тоже скидка: минус, тире или дефис перед числом с процентом (ревью блока G)", () => {
    expect(mentionsDiscount("−10% до конца месяца")).toBe(true);
    expect(mentionsDiscount("Акция -15 % на 2-комнатные")).toBe(true);
    expect(mentionsDiscount("Narx –5%")).toBe(true);
    expect(mentionsDiscount("Цена —10% до пятницы")).toBe(true);
    expect(mentionsDiscount("-15\u00a0% при 100% оплате")).toBe(true);
    expect(mentionsDiscount("Skidka 20%")).toBe(true);
  });

  it("диапазоны и проценты без знака — не скидка", () => {
    expect(mentionsDiscount("Первый взнос 30% — остальное в рассрочку")).toBe(false);
    expect(mentionsDiscount("0% рассрочка на 12 месяцев")).toBe(false);
    expect(mentionsDiscount("Первый взнос 10–30%")).toBe(false);
    expect(mentionsDiscount("Boshlang‘ich to‘lov 20-30%")).toBe(false);
    expect(mentionsDiscount("Ставка 1-2% в месяц")).toBe(false);
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
