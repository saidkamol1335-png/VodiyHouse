import { describe, expect, it } from "vitest";
import { greetingOf } from "./admin/greeting";
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatPrice,
  formatWeekdayDate,
  hourIn,
  initialsOf,
  parsePriceInput,
} from "./format";

// 19.10.2026, 12:00 по Ташкенту (UTC+5) — понедельник, как на скриншоте мокапа.
const MOCKUP_NOON = new Date("2026-10-19T07:00:00Z");
const tashkent = (hour: number) => new Date(Date.UTC(2026, 9, 19, hour - 5, 30));

describe("даты", () => {
  it("день недели и дата по Ташкенту", () => {
    expect(formatWeekdayDate(MOCKUP_NOON)).toBe("Понедельник, 19.10.2026");
  });

  it("за полночь по Ташкенту — уже следующий день, хотя в UTC ещё вчера", () => {
    expect(formatWeekdayDate(new Date("2026-10-19T19:30:00Z"))).toBe("Вторник, 20.10.2026");
  });

  it("час суток по Ташкенту", () => {
    expect(hourIn(MOCKUP_NOON)).toBe(12);
  });

  it("дата и дата со временем для списков кабинета — по Ташкенту", () => {
    expect(formatDate(new Date("2026-10-19T19:30:00Z"))).toBe("20.10.2026");
    expect(formatDateTime(new Date("2026-10-19T04:05:00Z"))).toBe("19.10.2026 09:05");
    expect(formatDateTime(new Date("2026-10-19T19:30:00Z"))).toBe("20.10.2026 00:30");
  });
});

describe("приветствие по времени суток", () => {
  it.each([
    [5, "morning"],
    [11, "morning"],
    [12, "day"],
    [17, "day"],
    [18, "evening"],
    [23, "evening"],
    [2, "evening"],
  ] as const)("%i:30 — %s", (hour, key) => {
    expect(greetingOf(tashkent(hour))).toBe(key);
  });
});

describe("инициалы", () => {
  it("два слова — две буквы, одно — одна", () => {
    expect(initialsOf("Дилноза Юсупова")).toBe("ДЮ");
    expect(initialsOf("  бахтиёр  ")).toBe("Б");
    expect(initialsOf("Сардор Алиев Ўғли")).toBe("СА");
  });
});

describe("вес файла", () => {
  it("КБ до мегабайта, МБ с одной цифрой до 10 МБ, дальше целые", () => {
    expect(formatFileSize(300)).toBe("1 КБ");
    expect(formatFileSize(512 * 1024)).toBe("512 КБ");
    expect(formatFileSize(2.44 * 1024 * 1024)).toBe("2,4 МБ");
    expect(formatFileSize(25 * 1024 * 1024)).toBe("25 МБ");
  });
});

describe("formatPrice", () => {
  it("USD — до доллара, сум — до тысячи, неразрывные пробелы между разрядами", () => {
    const plain = (text: string) => text.replace(/\s/g, " ");
    expect(plain(formatPrice(31000, "USD"))).toBe("$31 000");
    expect(plain(formatPrice(40270.4, "USD"))).toBe("$40 270");
    expect(plain(formatPrice(354_123_456, "UZS"))).toBe("354 123 000 сум");
  });

  it("ввод цены: разряды пробелами (и неразрывными); запятая, точка, минус и 10¹² — ошибка", () => {
    expect(parsePriceInput("31 000")).toEqual({ value: 31000 });
    expect(parsePriceInput("354 000 000")).toEqual({ value: 354_000_000 });
    expect(parsePriceInput("  ")).toEqual({ value: null });
    for (const raw of ["31,000", "31.000", "-5000", "5k"])
      expect(parsePriceInput(raw)).toEqual({ value: null, issue: "notNumber" });
    expect(parsePriceInput("0")).toEqual({ value: null, issue: "outOfRange" });
    expect(parsePriceInput("1000000000000")).toEqual({ value: null, issue: "outOfRange" });
    expect(parsePriceInput("999 999 999 999")).toEqual({ value: 999_999_999_999 });
  });
});
