import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { alertText, sheetRow, sourceLine, telegramText, type LeadRecord } from "./message";

// Сообщение в чат менеджеров — пример ТЗ 10.4; метка креатива (utm_content) доходит до Telegram и
// Таблицы (ТЗ 10.3).

const links = { site: "https://vodiyhouse.uz", cabinet: "https://vodiyhouse.uz/admin/zayavki" };

const lead: LeadRecord = {
  id: "id",
  number: 1045,
  created_at: "2026-09-26T13:45:00Z",
  type: "view",
  name: "Азиз",
  phone: "+998901234567",
  contact_lang: "uz",
  site_lang: "uz",
  subject: { slug: "shodlik", complex: { ru: "Shodlik", uz: "Shodlik" }, block: "A", layout: { rooms: 2, area: 67.1 } },
  page_url: "/uz/novostroyki/shodlik",
  source: { utm_source: "instagram", utm_medium: "cpc", utm_content: "shodlik_reels_03" },
  payload: { view: { target: "complex", day: "tomorrow", time: "evening" } },
  repeat_number: 1040,
  channels: ["telegram"],
};

describe("сообщение заявки", () => {
  it("Telegram: тип, повтор, объект, просмотр, контакт, язык, источник, страница, время по Ташкенту, ссылка", () => {
    expect(telegramText(lead, links).split("\n")).toEqual([
      "🟠 Новая заявка #1045 — Просмотр",
      "🔁 Повторное обращение — первая заявка #1040",
      "ЖК Shodlik · Блок A · 2-комн. 67,1 м²",
      "Посмотреть: этот ЖК, завтра, вечером",
      "Имя: Азиз",
      "Телефон: +998 90 123 45 67",
      "Язык общения: узбекский",
      "Источник: instagram / cpc / shodlik_reels_03",
      "Страница: https://vodiyhouse.uz/uz/novostroyki/shodlik",
      "26.09.2026 18:45",
      "Взять в работу: https://vodiyhouse.uz/admin/zayavki/1045",
    ]);
  });

  it("источник без меток: клик Meta, сайт-источник или прямой заход", () => {
    expect(sourceLine({ fbclid: "x" })).toBe("facebook / fbclid");
    expect(sourceLine({ referrer: "t.me" })).toBe("t.me");
    expect(sourceLine({})).toBe("прямой заход");
  });

  // Приёмник Apps Script (docs/leads-sheet.md) пишет столбцы по своему COLUMNS: поля, которого там
  // нет, в Таблице не будет.
  it("строка Таблицы: ключи совпадают со столбцами приёмника в docs/leads-sheet.md", () => {
    const doc = readFileSync(path.resolve(import.meta.dirname, "../../docs/leads-sheet.md"), "utf8").replace(/\r\n/g, "\n");
    const columns = /const COLUMNS = \[([\s\S]*?)\n\];/.exec(doc)?.[1] ?? "";
    const keys = [...columns.matchAll(/\["([a-z_]+)",/g)].map((match) => match[1]);
    expect(keys.length).toBeGreaterThan(0);
    expect(Object.keys(sheetRow(lead, links)).sort()).toEqual([...keys].sort());
  });

  it("строка Таблицы: поля ТЗ 10.3, utm_content отдельным столбцом", () => {
    expect(sheetRow(lead, links)).toMatchObject({
      number: 1045,
      created_at: "26.09.2026 18:45",
      type: "Просмотр",
      phone: "+998901234567",
      utm_content: "shodlik_reels_03",
      repeat_of: 1040,
      cabinet: "https://vodiyhouse.uz/admin/zayavki/1045",
    });
  });

  it("квиз: ответы, сколько подошло и ссылка на подходящие ЖК на сайте; без ответов — «без ответов» и без ссылки", () => {
    const quiz: LeadRecord = {
      ...lead,
      type: "quiz",
      page_url: "/ru/podbor",
      payload: { quiz: { answers: "2-комн. · до $45 000 · рассрочка", link: "/ru/novostroyki?komnat=2&do=45000&oplata=inst", complexes: 2, flats: 7, partial: false } },
    };
    const text = telegramText(quiz, links);
    expect(text).toContain("Ответы: 2-комн. · до $45 000 · рассрочка");
    expect(text).toContain("Подходит: 2 ЖК · 7 квартир");
    expect(text).toContain("Подходящие ЖК: https://vodiyhouse.uz/ru/novostroyki?komnat=2&do=45000&oplata=inst");
    expect(sheetRow(quiz, links).details).toContain("Подходит: 2 ЖК · 7 квартир");
    const empty = telegramText({ ...quiz, payload: { quiz: { answers: "", link: null, complexes: 0, flats: 0 } } }, links);
    expect(empty).toContain("Ответы: без ответов");
    expect(empty).toContain("Подходит: 0 ЖК · 0 квартир");
    expect(empty).not.toContain("Подходящие ЖК");
    // Наличие без числа у части типов: клиент видел «3+», менеджеру — «не меньше 3».
    const partial = telegramText({ ...quiz, payload: { quiz: { answers: "студия", link: null, complexes: 1, flats: 3, partial: true } } }, links);
    expect(partial).toContain("Подходит: 1 ЖК · не меньше 3 квартир");
  });

  it("тревога: сколько заявок не дошло и ссылки на них", () => {
    expect(alertText([{ number: 7, type: "callback" }, { number: 8, type: "calc" }], links.cabinet)).toContain(
      "2 заявки не дошли",
    );
  });
});
