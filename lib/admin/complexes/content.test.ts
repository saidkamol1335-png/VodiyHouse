import { describe, expect, it } from "vitest";
import type { DictionaryItem } from "../dictionaries/definitions";
import { detailField, detailRows, parseDetails } from "./details";
import { documentField, documentRows, parseDocuments, todayInTashkent } from "./documents";
import { parseVideos, videoDrafts, videoField, youtubeIdFrom } from "./videos";

// Вкладки «Видео», «Документы», «Детали» (шаг 3.5): разбор формы до базы.

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

const ID = "dQw4w9WgXcQ";
const PHOTO = "8f14e45f-ceea-467f-a0e6-2a5f1c3b9d10";

const item = (id: number, isActive = true): DictionaryItem => ({
  id,
  slug: `item-${id}`,
  name: { ru: `Тема ${id}`, uz: `Mavzu ${id}` },
  second: null,
  kind: null,
  isActive,
  sort: id * 10,
});

describe("ссылка YouTube → id ролика", () => {
  it("принимает привычные записи ссылки и сам id", () => {
    for (const link of [
      ID,
      `https://youtu.be/${ID}?t=42`,
      `youtu.be/${ID}`,
      `https://www.youtube.com/watch?v=${ID}&list=PL1`,
      `https://m.youtube.com/watch?v=${ID}`,
      `https://youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}?si=x`,
    ]) {
      expect(youtubeIdFrom(link), link).toBe(ID);
    }
  });

  it("чужой сайт, канал и обрезанный id — нет", () => {
    for (const link of ["https://vimeo.com/123", "https://www.youtube.com/@vodiyhouse", "https://youtu.be/short", "youtube.com/watch?v=", "просто текст"]) {
      expect(youtubeIdFrom(link), link).toBeNull();
    }
  });
});

describe("«Видео»", () => {
  const row = (key: string, link: string, ru = "", uz = ""): [string, string][] => [
    ["videoKey", key],
    [videoField(key, "link"), link],
    [`${videoField(key, "title")}.ru`, ru],
    [`${videoField(key, "title")}.uz`, uz],
  ];

  it("порядок — как в форме; пустая строка не шлётся; подпись необязательна", () => {
    const parsed = parseVideos(form([...row("b", `https://youtu.be/${ID}`, "Обзор", "Sharh"), ...row("x", ""), ...row("a", "aaaaaaaaaaa"), ["rule12", "on"]]));
    expect(parsed).toEqual({
      ok: true,
      payload: [
        { youtube_id: ID, title: { ru: "Обзор", uz: "Sharh" } },
        { youtube_id: "aaaaaaaaaaa", title: null },
      ],
    });
  });

  it("не ролик, повтор, половина подписи и контакты — ошибка у своей строки", () => {
    const parsed = parseVideos(
      form([...row("a", ID), ...row("b", `youtu.be/${ID}`), ...row("c", "vimeo.com/1"), ...row("d", "bbbbbbbbbbb", "Обзор"), ...row("e", "ccccccccccc", "+998 90 123 45 67", "x")]),
    );
    expect(parsed).toEqual({
      ok: false,
      error: null,
      errors: { b: { link: "duplicate" }, c: { link: "youtube" }, d: { title: "missingUz" }, e: { title: "contacts" } },
    });
  });

  it("правило 1.2: ролики без отметки «контактов застройщика нет» не сохраняются; пустой список — можно", () => {
    expect(parseVideos(form(row("a", ID)))).toEqual({ ok: false, error: "rule12" });
    expect(parseVideos(form(row("x", "")))).toEqual({ ok: true, payload: [] });
  });

  it("больше шести — отказ целиком", () => {
    const rows = Array.from({ length: 7 }, (_, index) => row(String(index), `${"a".repeat(10)}${index}`)).flat();
    expect(parseVideos(form(rows))).toEqual({ ok: false, error: "tooMany" });
  });

  it("сохранённое → строки со ссылкой youtu.be", () => {
    expect(videoDrafts([{ youtube_id: ID, title: null }])).toEqual([{ key: ID, link: `https://youtu.be/${ID}`, title: { ru: "", uz: "" } }]);
  });
});

describe("«Документы»", () => {
  const TODAY = "2026-10-25";

  it("дата — документ проверен; пусто — его нет на сайте", () => {
    const parsed = parseDocuments(
      form([
        ["documentType", "1"],
        [documentField(1), "2026-09-12"],
        ["documentType", "2"],
        [documentField(2), ""],
        ["documentType", "3"],
        [documentField(3), TODAY],
      ]),
      TODAY,
    );
    expect(parsed).toEqual({
      ok: true,
      payload: [
        { type_id: 1, checked_on: "2026-09-12" },
        { type_id: 3, checked_on: TODAY },
      ],
    });
  });

  it("завтрашняя и несуществующая дата — ошибка у своего документа", () => {
    const parsed = parseDocuments(
      form([
        ["documentType", "1"],
        [documentField(1), "2026-10-26"],
        ["documentType", "2"],
        [documentField(2), "2026-02-30"],
      ]),
      TODAY,
    );
    expect(parsed).toEqual({ ok: false, errors: { 1: "futureDate", 2: "dateInvalid" } });
  });

  it("строки — по справочнику; выключенный тип — только если уже проверен", () => {
    const rows = documentRows([item(1), item(2, false), item(3, false)], [{ document_type_id: 3, checked_on: "2026-09-01" }]);
    expect(rows.map((row) => [row.typeId, row.checkedOn])).toEqual([
      [1, ""],
      [3, "2026-09-01"],
    ]);
  });

  it("сегодня — по Ташкенту: 20:30 UTC — уже следующий день", () => {
    expect(todayInTashkent(new Date("2026-10-25T20:30:00Z"))).toBe("2026-10-26");
  });
});

describe("«Детали»", () => {
  const topic = (id: number, ru: string, uz: string, photo = ""): [string, string][] => [
    ["detailTopic", String(id)],
    [`${detailField(id, "text")}.ru`, ru],
    [`${detailField(id, "text")}.uz`, uz],
    [detailField(id, "photo"), photo],
  ];

  it("тема с текстом — на сайт, с фото из галереи; пустая — нет", () => {
    expect(parseDetails(form([...topic(1, "О проекте", "Loyiha haqida", PHOTO), ...topic(2, "", "")]))).toEqual({
      ok: true,
      payload: [{ topic_id: 1, text: { ru: "О проекте", uz: "Loyiha haqida" }, photo_id: PHOTO }],
    });
  });

  it("половина текста, длинный текст и контакты застройщика — ошибка у темы", () => {
    const parsed = parseDetails(form([...topic(1, "О проекте", ""), ...topic(2, "a".repeat(2001), "b"), ...topic(3, "Звоните: t.me/sifat", "Qo‘ng‘iroq")]));
    expect(parsed).toEqual({ ok: false, errors: { 1: "missingUz", 2: "tooLong", 3: "contacts" } });
  });

  it("фото у темы без текста — ошибка у темы, а не молча пропало", () => {
    expect(parseDetails(form([...topic(1, "", "", PHOTO)]))).toEqual({ ok: false, errors: { 1: "photoWithoutText" } });
  });

  it("строки — по справочнику; выключенная тема — только если у ЖК есть текст", () => {
    const rows = detailRows([item(1), item(2, false), item(3, false)], [{ topic_id: 2, text: { ru: "a", uz: "b" }, photo_id: null }]);
    expect(rows.map((row) => [row.topicId, row.text.ru])).toEqual([
      [1, ""],
      [2, "a"],
    ]);
  });
});
