import { describe, expect, it } from "vitest";
import { greetingOf } from "./admin/greeting";
import {
  formatDate,
  formatDateTime,
  formatFileSize,
  formatPercent,
  formatPrice,
  formatPriceShort,
  formatRate,
  formatWeekdayDate,
  hourIn,
  initialsOf,
  parseMonthsInput,
  parsePriceInput,
  relativeStamp,
  termParts,
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
    expect(plain(formatPrice(354_123_456, "UZS", "uz"))).toBe("354 123 000 so‘m");
  });

  it("коротко для тесных мест: «22,5 млн сум», «1,2 млрд сум»; доллары и меньше миллиона — полностью", () => {
    const plain = (text: string) => text.replace(/\s/g, " ");
    expect(plain(formatPriceShort(22_468_615, "UZS"))).toBe("22,5 млн сум");
    expect(plain(formatPriceShort(22_468_615, "UZS", "uz"))).toBe("22,5 mln so‘m");
    expect(plain(formatPriceShort(1_158_636_000, "UZS"))).toBe("1,2 млрд сум");
    expect(plain(formatPriceShort(950_400, "UZS"))).toBe("950 000 сум");
    expect(plain(formatPriceShort(1401.18, "USD"))).toBe("$1 401");
  });

  it("курс, проценты, срок годами от 5 лет", () => {
    expect(formatRate(11808.76).replace(/\s/g, " ")).toBe("11 808,76");
    expect(formatPercent(20)).toBe("20%");
    expect(formatPercent(17.5)).toBe("17,5%");
    expect(termParts(24)).toEqual({ unit: "months", count: 24 });
    expect(termParts(180)).toEqual({ unit: "years", count: 15 });
    expect(termParts(66)).toEqual({ unit: "months", count: 66 });
  });

  it("свой срок: целое 1–600 мес.", () => {
    expect(parseMonthsInput("17")).toBe(17);
    expect(parseMonthsInput(" 600 ")).toBe(600);
    for (const raw of ["0", "601", "1.5", "-3", "", "abc"])
      expect(parseMonthsInput(raw)).toBeNull();
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

describe("relativeStamp — «обновлено …» в списке квартир", () => {
  // 21.10.2026, 14:46 по Ташкенту.
  const now = new Date("2026-10-21T09:46:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it("до 45 с и время из будущего — «только что»", () => {
    expect(relativeStamp(ago(44_000), now)).toEqual({ kind: "now" });
    expect(relativeStamp(new Date(now.getTime() + 60_000), now)).toEqual({ kind: "now" });
  });

  it("минуты до часа", () => {
    expect(relativeStamp(ago(45_000), now)).toEqual({ kind: "minutes", minutes: 1 });
    expect(relativeStamp(ago(5 * 60_000), now)).toEqual({ kind: "minutes", minutes: 5 });
    expect(relativeStamp(ago(59 * 60_000), now)).toEqual({ kind: "minutes", minutes: 59 });
  });

  it("сегодня и вчера — по календарю Ташкента, а не UTC", () => {
    expect(relativeStamp(ago(3 * 3_600_000), now)).toEqual({ kind: "today", time: "11:46" });
    // 00:10 по Ташкенту — ещё 20.10 по UTC, но уже «сегодня».
    expect(relativeStamp(new Date("2026-10-20T19:10:00Z"), now)).toEqual({
      kind: "today",
      time: "00:10",
    });
    expect(relativeStamp(new Date("2026-10-20T18:50:00Z"), now)).toEqual({
      kind: "yesterday",
      time: "23:50",
    });
  });

  it("ровно час и 59,5 мин — уже «сегодня в», а не «60 мин назад»", () => {
    expect(relativeStamp(ago(60 * 60_000), now)).toEqual({ kind: "today", time: "13:46" });
    expect(relativeStamp(ago(59 * 60_000 + 30_000), now)).toMatchObject({ kind: "today" });
  });

  it("неверная дата — null, а не исключение", () => {
    expect(relativeStamp(new Date("не время"), now)).toBeNull();
  });

  it("раньше — дата; другой год — с годом", () => {
    expect(relativeStamp(new Date("2026-10-18T04:05:00Z"), now)).toEqual({
      kind: "date",
      date: "18.10",
      time: "09:05",
    });
    expect(relativeStamp(new Date("2025-12-31T04:05:00Z"), now)).toEqual({
      kind: "date",
      date: "31.12.2025",
      time: "09:05",
    });
  });
});
