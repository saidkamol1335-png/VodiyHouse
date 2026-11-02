import { describe, expect, it } from "vitest";
import { maskPhone } from "./phoneMask";

// Маска телефона формы заявки: набор по цифре от «+998 », вставка в любой записи.

describe("maskPhone", () => {
  it("вставка: местный номер, полный, со скобками и дефисами", () => {
    expect(maskPhone("901234567")).toBe("+998 90 123 45 67");
    expect(maskPhone("998901234567")).toBe("+998 90 123 45 67");
    expect(maskPhone("+998 (90) 123-45-67")).toBe("+998 90 123 45 67");
  });

  it("местный номер оператора 99 с цифрой 8 — не код страны", () => {
    expect(maskPhone("998123456")).toBe("+998 99 812 34 56");
    expect(maskPhone("+998 99 812 34 56")).toBe("+998 99 812 34 56");
  });

  it("набор по цифре после «+998 »", () => {
    expect(maskPhone("+998 9")).toBe("+998 9");
    expect(maskPhone("+998 99")).toBe("+998 99");
    expect(maskPhone("+998 99 8")).toBe("+998 99 8");
    expect(maskPhone("+998 99 812 34 567")).toBe("+998 99 812 34 56");
  });

  it("пусто — пусто; одни знаки — заготовка «+998 »", () => {
    expect(maskPhone("")).toBe("");
    expect(maskPhone("+")).toBe("+998 ");
  });
});
