import { describe, expect, it } from "vitest";
import { statsCsv, statsCsvFilename } from "./csv";
import type { ProgressStats, SiteStats } from "./types";

const totals = {
  visitors: 3,
  visits: 4,
  views: 9,
  contacts: 1,
  complex_visitors: 2,
  layout_visitors: 1,
  leads: 1,
};
const point = (day: string, hour: number, cur: SiteStats["series"][number]["cur"]) => ({
  day,
  hour,
  cur,
  prev: { visitors: 0, visits: 0, views: 0, leads: 0, contacts: 0 },
});

const stats = (patch: Partial<SiteStats>): SiteStats => ({
  from: "2026-10-27",
  to: "2026-10-28",
  until: "2026-10-28T19:00:00Z",
  hourly: false,
  prev_from: "2026-10-25",
  prev_to: "2026-10-26",
  totals,
  prev: { ...totals, visitors: 2 },
  prev_has_data: true,
  series: [
    point("2026-10-27", 0, { visitors: 1, visits: 1, views: 3, leads: 0, contacts: 0 }),
    point("2026-10-28", 0, { visitors: 2, visits: 3, views: 6, leads: 1, contacts: 1 }),
  ],
  lead_types: [],
  sources: [],
  devices: [],
  langs: [],
  creatives: [],
  complexes: [],
  developers: [],
  ...patch,
});

describe("CSV статистики", () => {
  it("период до «сейчас» — в подписях итога и прошлого периода «до ЧЧ:ММ» по Ташкенту", () => {
    const csv = statsCsv(stats({ until: "2026-10-28T09:40:00Z" }));
    expect(csv).toContain("Итого 27.10.2026 — 28.10.2026, до 14:40;");
    expect(csv).toContain("Прошлый период 25.10.2026 — 26.10.2026, до 14:40;");
  });

  it("BOM, «;», строка на день, итог и прошлый период, CRLF", () => {
    const lines = statsCsv(stats({})).split("\r\n");
    expect(lines[0]).toBe("﻿Дата;Посетители;Визиты;Просмотры;Заявки;Контакты (телефон / Telegram)");
    expect(lines[1]).toBe("27.10.2026;1;1;3;0;0");
    expect(lines[2]).toBe("28.10.2026;2;3;6;1;1");
    expect(lines[3]).toBe("Итого 27.10.2026 — 28.10.2026;3;4;9;1;1");
    expect(lines[4]).toBe("Прошлый период 25.10.2026 — 26.10.2026;2;4;9;1;1");
    expect(lines.at(-1)).toBe("");
  });

  it("один день — по часам; не наступившие часы пустые; без прошлого периода строки нет", () => {
    const csv = statsCsv(
      stats({
        hourly: true,
        until: "2026-10-29T19:00:00Z",
        from: "2026-10-29",
        to: "2026-10-29",
        prev_has_data: false,
        series: [
          point("2026-10-29", 9, { visitors: 5, visits: 5, views: 7, leads: 0, contacts: 0 }),
          point("2026-10-29", 23, null),
        ],
      }),
    );
    const lines = csv.split("\r\n");
    expect(lines[0]!.startsWith("﻿Час;")).toBe(true);
    expect(lines[1]).toBe("09:00;5;5;7;0;0");
    expect(lines[2]).toBe("23:00;;;;;");
    expect(csv).not.toContain("Прошлый период");
    // until 29.10 19:00 UTC = 00:00 30.10 по Ташкенту — 29.10 посчитан целиком, без «до …».
    expect(csv).toContain("Итого 29.10.2026 — 29.10.2026;");
    expect(statsCsvFilename({ from: "2026-10-29", to: "2026-10-29" })).toBe(
      "vodiyhouse-statistika-2026-10-29_2026-10-29.csv",
    );
  });

  it("«Ход стройки» (фаза F): числа и ЖК без отчёта — секцией после итогов; не прочитался — строкой", () => {
    const progress: ProgressStats = {
      from: "2026-10-27",
      to: "2026-10-28",
      until: "2026-10-28T19:00:00Z",
      month: "2026-10-01",
      month_open: true,
      published: 4,
      returned: 2,
      returned_reports: 1,
      unit_published: 1,
      unit_returned: 0,
      wait_count: 5,
      wait_avg_hours: 6.5,
      wait_max_hours: 20,
      waiting_now: 1,
      oldest_wait_hours: 3,
      complexes_building: 3,
      complexes_without: [
        {
          id: "c1",
          name: { ru: "=Shodlik; «A»", uz: "Shodlik" },
          status: "published",
          blocks_total: 2,
          blocks_done: 0,
          missing: [
            { id: "b1", name: "A", state: "none" },
            { id: "b2", name: "B", state: "returned" },
          ],
          last_published_at: null,
          late: true,
        },
      ],
    };
    const lines = statsCsv(stats({}), progress).split("\r\n");
    const at = lines.indexOf("Ход стройки 27.10.2026 — 28.10.2026");
    expect(at).toBeGreaterThan(0);
    expect(lines[at - 1]).toBe("");
    expect(lines.slice(at + 1, at + 9)).toEqual([
      "Опубликовано отчётов блоков;4",
      "Опубликовано видео квартир;1",
      "Возвратов автору;2",
      "Возвращённых отчётов;1",
      "Возвратов видео квартир;0",
      "Среднее ожидание проверки, ч;6,5",
      "Дольше всех, ч;20",
      "Ждут проверки сейчас;1",
    ]);
    expect(lines).toContain("ЖК без отчёта за октябрь 2026");
    // Название ЖК — ячейкой: «=» не формула, «;» не делит строку.
    expect(lines).toContain(`"'=Shodlik; «A»";A, B (возвращён);не было`);
    expect(statsCsv(stats({}), null)).toContain("\r\nХод стройки: не прочитался\r\n");
    expect(statsCsv(stats({}))).not.toContain("Ход стройки");
  });
});
