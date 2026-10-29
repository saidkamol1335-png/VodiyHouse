import { describe, expect, it } from "vitest";
import { chartLabelIndexes, chartPaths, chartStep, chartTicks } from "./chart";
import { conversion, statsBars, statsDelta } from "./numbers";
import { addDays, daysIn, statsPeriodOf, statsPeriodQuery } from "./period";
import { statsChannel, visitorsByChannel } from "./sources";

const TODAY = "2026-10-29";

describe("период статистики", () => {
  it("кнопки мокапа → дни по Ташкенту", () => {
    expect(statsPeriodOf({ per: "today" }, TODAY)).toEqual({
      key: "today",
      from: TODAY,
      to: TODAY,
    });
    expect(statsPeriodOf({ per: "7" }, TODAY)).toEqual({ key: "7", from: "2026-10-23", to: TODAY });
    expect(statsPeriodOf({ per: "30" }, TODAY)).toEqual({
      key: "30",
      from: "2026-09-30",
      to: TODAY,
    });
    expect(statsPeriodOf({ per: "month" }, TODAY)).toEqual({
      key: "month",
      from: "2026-10-01",
      to: TODAY,
    });
    expect(statsPeriodOf({}, TODAY).key).toBe("30");
    expect(statsPeriodOf({ per: "hack" }, TODAY).key).toBe("30");
  });

  it("свой период: даты местами, будущее и старше 400 дней — к границам, битое — по умолчанию", () => {
    expect(
      statsPeriodOf({ per: "custom", from: "2026-10-20", to: "2026-10-01" }, TODAY),
    ).toMatchObject({ from: "2026-10-01", to: "2026-10-20" });
    expect(
      statsPeriodOf({ per: "custom", from: "2020-01-01", to: "2027-01-01" }, TODAY),
    ).toMatchObject({ from: addDays(TODAY, -400), to: TODAY });
    expect(statsPeriodOf({ per: "custom", from: "вчера", to: ["x"] }, TODAY)).toMatchObject({
      from: "2026-10-16",
      to: TODAY,
    });
  });

  it("дни и адрес", () => {
    expect(daysIn("2026-09-30", TODAY)).toBe(30);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(statsPeriodQuery({ key: "7", from: "2026-10-23", to: TODAY })).toBe("per=7");
    expect(statsPeriodQuery({ key: "custom", from: "2026-10-01", to: "2026-10-20" })).toBe(
      "per=custom&from=2026-10-01&to=2026-10-20",
    );
  });
});

describe("числа статистики", () => {
  it("изменение к прошлому периоду; без прошлого — «нет данных»", () => {
    expect(statsDelta(9114, 7558, true)).toEqual({ kind: "up", percent: 20.6 });
    expect(statsDelta(90, 100, true)).toEqual({ kind: "down", percent: 10 });
    expect(statsDelta(5, 5, true)).toEqual({ kind: "flat", percent: 0 });
    expect(statsDelta(5, 0, true)).toEqual({ kind: "none" });
    expect(statsDelta(5, 3, false)).toEqual({ kind: "none" });
  });

  it("конверсия и полосы панелей", () => {
    expect(conversion(212, 9114)).toBe(2.3);
    expect(conversion(1, 0)).toBeNull();
    expect(
      statsBars([
        { key: "a", value: 1 },
        { key: "b", value: 3 },
        { key: "c", value: 0 },
      ]),
    ).toEqual([
      { key: "b", value: 3, share: 75, width: 100 },
      { key: "a", value: 1, share: 25, width: 33.3 },
    ]);
  });
});

describe("каналы источников", () => {
  it("метки и домены → канал; пусто — прямой заход", () => {
    expect(["instagram", "IG", "l.instagram.com"].map(statsChannel)).toEqual([
      "instagram",
      "instagram",
      "instagram",
    ]);
    expect(["t.me", "telegram", "web.telegram.org"].map(statsChannel)).toEqual([
      "telegram",
      "telegram",
      "telegram",
    ]);
    expect(["google", "www.google.com", "google.co.uz"].map(statsChannel)).toEqual([
      "google",
      "google",
      "google",
    ]);
    expect(["fb", "m.facebook.com", "yandex.uz", "youtu.be"].map(statsChannel)).toEqual([
      "facebook",
      "facebook",
      "yandex",
      "youtube",
    ]);
    expect([null, "", "olx.uz", "notgoogle.com"].map(statsChannel)).toEqual([
      "direct",
      "direct",
      "other",
      "other",
    ]);
  });

  it("суммы по каналам", () => {
    expect(
      visitorsByChannel([
        { source: "instagram", visitors: 3 },
        { source: "l.instagram.com", visitors: 2 },
        { source: null, visitors: 4 },
      ]),
    ).toEqual([
      { key: "instagram", value: 5 },
      { key: "direct", value: 4 },
    ]);
  });
});

describe("график статистики", () => {
  it("шаг оси Y — круглый, 4 деления покрывают максимум", () => {
    expect(chartStep(800)).toBe(200);
    expect(chartStep(730)).toBe(200);
    expect(chartStep(9)).toBe(2.5);
    expect(chartStep(0)).toBe(1);
    expect(chartTicks(41)).toEqual([0, 20, 40, 60, 80]);
  });

  it("подписи X: сегодня — часы мокапа, иначе до 7 равномерно с концами", () => {
    expect(chartLabelIndexes(24, true)).toEqual([0, 4, 8, 12, 16, 20, 23]);
    expect(chartLabelIndexes(30, false)).toEqual([0, 5, 10, 15, 19, 24, 29]);
    expect(chartLabelIndexes(3, false)).toEqual([0, 1, 2]);
    expect(chartLabelIndexes(1, false)).toEqual([0]);
  });

  it("пути: линия обрывается на будущих часах, одна точка — горизонталь, прошлый — пунктир", () => {
    const paths = chartPaths([4, 8, null], [2, 2, 2]);
    expect(paths.top).toBe(8);
    expect(paths.line).toBe("M0.0,150.0L500.0,0.0");
    expect(paths.area).toBe("M0.0,300.0L0.0,150.0L500.0,0.0L500.0,300.0Z");
    expect(paths.prev).toBe("M0.0,225.0L500.0,225.0L1000.0,225.0");
    expect(chartPaths([5], null).line).toBe("M0.0,112.5L1000.0,112.5");
    expect(chartPaths([null, null], null)).toMatchObject({ line: "", area: "", prev: "" });
  });
});
