// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEVELOPER_LIMITS, parseDeveloperMain } from "./mainForm";
import { PRIVATE_LIMITS, parsePrivateNotes } from "./privateNotes";
import { draftsFrom, parseProjects, PROJECT_LIMITS } from "./projects";

const MIGRATION = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../supabase/migrations/20261019170000_developers_complexes_media.sql",
  ),
  "utf8",
);

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.append(name, value);
  return data;
}

const GOOD_MAIN = {
  name: "  Farg‘ona   Sifat Qurilish ",
  foundedYear: "2012",
  flatsDelivered: "2 140",
  deliveredCheckedAt: "2026-09-14",
  "about.ru": " Строит с 2012 года. ",
  "about.uz": "2012 yildan beri quradi.",
  "founders.ru": "",
  "founders.uz": "",
};

describe("пределы совпадают с check в базе", () => {
  it("название, год, сдано квартир, внутреннее, сданный объект", () => {
    const { nameMin, nameMax, yearMin, yearMax } = DEVELOPER_LIMITS;
    expect(MIGRATION).toContain(`length(btrim(name)) between ${nameMin} and ${nameMax}`);
    expect(MIGRATION).toContain(`founded_year between ${yearMin} and ${yearMax}`);
    expect(MIGRATION).toContain("flats_delivered >= 0");
    expect(MIGRATION).toContain(`length(contacts) <= ${PRIVATE_LIMITS.contactsMax}`);
    expect(MIGRATION).toContain(`length(notes) <= ${PRIVATE_LIMITS.notesMax}`);
    expect(MIGRATION).toContain(`length(name ->> 'ru') <= ${PROJECT_LIMITS.nameMax}`);
  });
});

describe("вкладка «Основное»", () => {
  it("правильная форма — значения для базы: пробелы убраны, пустые основатели — null", () => {
    const parsed = parseDeveloperMain(form(GOOD_MAIN));
    expect(parsed).toMatchObject({
      ok: true,
      value: {
        name: "Farg‘ona Sifat Qurilish",
        foundedYear: 2012,
        flatsDelivered: 2140,
        deliveredCheckedAt: "2026-09-14",
        about: { ru: "Строит с 2012 года.", uz: "2012 yildan beri quradi." },
        founders: null,
      },
    });
  });

  it("ошибки по полям; введённое возвращается в форму", () => {
    const parsed = parseDeveloperMain(
      form({
        ...GOOD_MAIN,
        name: "F",
        foundedYear: "1890",
        flatsDelivered: "12.5",
        deliveredCheckedAt: "2026-02-31",
        "about.uz": "",
        "founders.ru": "Х".repeat(DEVELOPER_LIMITS.foundersMax + 1),
        "founders.uz": "Asoschi",
      }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.fieldErrors).toEqual({
      name: "tooShort",
      foundedYear: "outOfRange",
      flatsDelivered: "notWholeNumber",
      deliveredCheckedAt: "dateInvalid",
      about: "missingUz",
      founders: "tooLong",
    });
    expect(parsed.fields.name).toBe("F");
  });

  it("пустые необязательные поля — null; без названия — required", () => {
    const parsed = parseDeveloperMain(form({ name: "Yangi Makon" }));
    expect(parsed).toMatchObject({
      ok: true,
      value: { foundedYear: null, flatsDelivered: null, deliveredCheckedAt: null, about: null },
    });
    expect(parseDeveloperMain(form({ name: "  " }))).toMatchObject({
      ok: false,
      fieldErrors: { name: "required" },
    });
  });

  it("повторённое поле (подделанная форма) читается как пустое", () => {
    const data = form(GOOD_MAIN);
    data.append("name", "Второе название");
    expect(parseDeveloperMain(data)).toMatchObject({
      ok: false,
      fieldErrors: { name: "required" },
    });
  });
});

describe("вкладка «Сданные объекты»", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    key: "row-1",
    id: null,
    name: { ru: "Дом на ул. Мустакиллик, 14", uz: "Mustaqillik ko‘chasi, 14-uy" },
    plannedOn: "2021-06-30",
    deliveredOn: "2021-06-30",
    ...overrides,
  });
  const projects = (rows: unknown) => parseProjects(form({ projects: JSON.stringify(rows) }));

  it("список по порядку → данные для save_developer_past_projects (id — только у сохранённых)", () => {
    const id = "6f1c2b9e-1d2a-4b4e-9a51-3c0f3c7d1a20";
    expect(projects([row(), row({ key: id, id, deliveredOn: null })])).toEqual({
      ok: true,
      payload: [
        { name: row().name, planned_on: "2021-06-30", delivered_on: "2021-06-30" },
        { id, name: row().name, planned_on: "2021-06-30", delivered_on: null },
      ],
    });
  });

  it("ошибки — по ключу строки: нет перевода, битая дата", () => {
    const parsed = projects([
      row(),
      row({ key: "row-2", name: { ru: "Дом", uz: "" }, plannedOn: "2021-13-31" }),
    ]);
    expect(parsed).toEqual({
      ok: false,
      error: null,
      rowErrors: { "row-2": { name: "missingUz", plannedOn: "dateInvalid" } },
    });
  });

  it("битый JSON, чужой id, больше 50 строк — отказ целиком", () => {
    expect(parseProjects(form({ projects: "{" }))).toEqual({ ok: false, error: "invalid" });
    expect(projects([row({ id: "1; drop table" })])).toEqual({ ok: false, error: "invalid" });
    expect(
      projects(
        Array.from({ length: PROJECT_LIMITS.maxRows + 1 }, (_, index) => row({ key: `r${index}` })),
      ),
    ).toEqual({
      ok: false,
      error: "tooMany",
    });
  });

  it("строки из базы → черновики формы", () => {
    expect(
      draftsFrom([
        { id: "a", name: { ru: "Дом", uz: "Uy" }, planned_on: null, delivered_on: "2023-03-31" },
      ]),
    ).toEqual([
      {
        key: "a",
        id: "a",
        name: { ru: "Дом", uz: "Uy" },
        plannedOn: null,
        deliveredOn: "2023-03-31",
      },
    ]);
  });
});

describe("вкладка «Внутреннее»", () => {
  it("переводы строк сохраняются; длиннее предела — ошибка", () => {
    expect(
      parsePrivateNotes(form({ contacts: " Отдел продаж\n+998 90 000 00 00 ", notes: "" })),
    ).toEqual({
      ok: true,
      value: { contacts: "Отдел продаж\n+998 90 000 00 00", notes: "" },
    });
    expect(
      parsePrivateNotes(form({ contacts: "", notes: "я".repeat(PRIVATE_LIMITS.notesMax + 1) })),
    ).toMatchObject({
      ok: false,
      fieldErrors: { notes: "tooLong" },
    });
  });
});
