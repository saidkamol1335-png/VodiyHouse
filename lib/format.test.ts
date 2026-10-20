import { describe, expect, it } from "vitest";
import { greetingOf } from "./admin/greeting";
import { formatDate, formatDateTime, formatFileSize, formatWeekdayDate, hourIn, initialsOf } from "./format";

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
