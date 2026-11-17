import { describe, expect, it } from "vitest";
import type { DictionaryItem } from "../dictionaries/definitions";
import { detailDrafts, detailField, detailTopics, parseDetails } from "./details";
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

describe("«Детали» (правки 15.11, п. 22: пункты с порядком)", () => {
  const row = (key: string, topic: number | "", ru: string, uz: string, photo = "", id = ""): [string, string][] => [
    ["detailKey", key],
    [detailField(key, "id"), id],
    [detailField(key, "topic"), String(topic)],
    [`${detailField(key, "text")}.ru`, ru],
    [`${detailField(key, "text")}.uz`, uz],
    [detailField(key, "photo"), photo],
  ];

  it("пункты — в порядке формы, одна тема дважды, id сохранённого — на месте; пустой — нет", () => {
    expect(parseDetails(form([...row("a", 3, "Двор", "Hovli", PHOTO, PHOTO), ...row("b", 3, "Фасад", "Fasad"), ...row("c", 1, "", "")]))).toEqual({
      ok: true,
      payload: [
        { id: PHOTO, topic_id: 3, text: { ru: "Двор", uz: "Hovli" }, photo_id: PHOTO },
        { id: null, topic_id: 3, text: { ru: "Фасад", uz: "Fasad" }, photo_id: null },
      ],
    });
  });

  it("половина текста, длинный текст, контакты застройщика, нет темы — ошибка у пункта", () => {
    const parsed = parseDetails(form([...row("a", 1, "О проекте", ""), ...row("b", 2, "a".repeat(2001), "b"), ...row("c", 3, "Звоните: t.me/sifat", "Qo‘ng‘iroq"), ...row("d", "", "Текст", "Matn")]));
    expect(parsed).toEqual({ ok: false, error: null, errors: { a: "missingUz", b: "tooLong", c: "contacts", d: "topicMissing" } });
  });

  it("фото у пункта без текста — ошибка, а не молча пропало; больше 20 — отказ", () => {
    expect(parseDetails(form([...row("a", 1, "", "", PHOTO)]))).toEqual({ ok: false, error: null, errors: { a: "photoWithoutText" } });
    expect(parseDetails(form(Array.from({ length: 21 }, (_, n) => row(`k${n}`, 1, "Текст", "Matn")).flat()))).toEqual({ ok: false, error: "tooMany" });
  });

  it("сохранённые — строками формы; темы — включённые и уже выбранные", () => {
    const records = [{ id: PHOTO, topic_id: 2, text: { ru: "a", uz: "b" }, photo_id: null }];
    expect(detailDrafts(records).map((draft) => [draft.key, draft.topicId, draft.text.ru])).toEqual([[PHOTO, 2, "a"]]);
    expect(detailTopics([item(1), item(2, false), item(3, false)], records).map((topic) => topic.id)).toEqual([1, 2]);
  });
});

