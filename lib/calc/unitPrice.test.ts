import { describe, expect, it } from "vitest";
import { formatPrice, formatPricePerM2, parsePriceInput, PRICE_PER_M2_MAX } from "@/lib/format";
import { unitPricePerM2, unitTotalPrice } from "./unitPrice";

// Intl ставит неразрывные пробелы в группах цифр.
const plain = (text: string) => text.replace(/\s/g, " ");

describe("цена квартиры (Н3)", () => {
  it("целиком — как есть; за м² — площадь × цена м², без округления", () => {
    expect(unitTotalPrice({ price: 37200, pricePerM2: null }, 60)).toBe(37200);
    expect(unitTotalPrice({ price: null, pricePerM2: 620 }, 42.5)).toBe(26350);
    expect(unitTotalPrice({ price: null, pricePerM2: 620.5 }, 42.55)).toBeCloseTo(26402.275, 6);
    // Как numeric базы: 5388,5 → «$5 389», а не 5388,4999… → «$5 388».
    expect(unitTotalPrice({ price: null, pricePerM2: 325 }, 16.58)).toBe(5388.5);
    expect(
      plain(formatPrice(unitTotalPrice({ price: null, pricePerM2: 325 }, 16.58)!, "USD")),
    ).toBe("$5 389");
  });

  it("без цены или без площади при цене за м² — «по запросу»", () => {
    expect(unitTotalPrice({ price: null, pricePerM2: null }, 60)).toBeNull();
    expect(unitTotalPrice({ price: null, pricePerM2: 620 }, null)).toBeNull();
  });

  it("цена за м² для строки «$37 200 · $620/м²»", () => {
    expect(unitPricePerM2({ price: null, pricePerM2: 620 }, null)).toBe(620);
    expect(unitPricePerM2({ price: 37200, pricePerM2: null }, 60)).toBe(620);
    expect(unitPricePerM2({ price: 37200, pricePerM2: null }, null)).toBeNull();
  });

  it("вывод округляет: $26 350 · $620/м², сумы — до тысячи", () => {
    expect(plain(formatPrice(26350.4, "USD"))).toBe("$26 350");
    expect(plain(formatPricePerM2(620, "USD"))).toBe("$620/м²");
    expect(plain(formatPricePerM2(4_100_400, "UZS"))).toBe("4 100 000 сум/м²");
  });

  it("ввод цены за м² — свой предел (площадь × цена м² влезает в «цену от»)", () => {
    expect(parsePriceInput("999 999 999", PRICE_PER_M2_MAX)).toEqual({ value: 999_999_999 });
    expect(parsePriceInput("1 000 000 000", PRICE_PER_M2_MAX)).toEqual({
      value: null,
      issue: "outOfRange",
    });
  });
});
