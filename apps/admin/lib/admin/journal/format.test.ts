import { describe, expect, it } from "vitest";
import { journalEntries, journalPage, journalValue, type JournalRecord } from "./format";

const record = (overrides: Partial<JournalRecord>): JournalRecord => ({
  id: 10,
  at: "2026-10-20T09:05:00Z",
  action: "update",
  entity: "developers",
  entity_id: "d-1",
  changes: {},
  actor_name: "Бахтиёр Каримов",
  subject: "Farg‘ona Sifat Qurilish",
  ...overrides,
});

describe("значения в журнале", () => {
  it("пусто, флаг, статус публикации, текст на двух языках, даты, числа", () => {
    expect(journalValue("developers", "about", null)).toEqual({ kind: "empty" });
    expect(journalValue("locations", "is_active", false)).toEqual({ kind: "flag", on: false });
    expect(journalValue("developers", "status", "published")).toEqual({
      kind: "status",
      status: "published",
    });
    expect(journalValue("units", "status", "sold")).toEqual({ kind: "unitStatus", status: "sold" });
    expect(journalValue("developers", "about", { ru: "Строит", uz: "Quradi" })).toEqual({
      kind: "bilingual",
      ru: "Строит",
      uz: "Quradi",
    });
    expect(journalValue("developers", "delivered_checked_at", "2026-09-14")).toEqual({
      kind: "date",
      iso: "2026-09-14",
    });
    expect(journalValue("developers", "founded_year", 2012)).toEqual({
      kind: "text",
      text: "2012",
    });
  });

  it("деньги: цена квартиры и «цена от» планировки — с валютой блока; у ЖК число — текстом", () => {
    const usd = { currency: "USD" as const };
    expect(journalValue("layouts", "price_from", 26402.28, usd)).toEqual({
      kind: "money",
      amount: 26402.28,
      currency: "USD",
      perM2: false,
    });
    expect(journalValue("units", "price_per_m2", 620, usd)).toMatchObject({ perM2: true });
    expect(journalValue("complexes", "price_from", 5)).toEqual({ kind: "text", text: "5" });
  });

  it("длинный текст обрезается", () => {
    const value = journalValue("developer_private", "notes", "я".repeat(500));
    expect(value.kind === "text" && value.text.length).toBe(140);
  });
});

describe("записи журнала", () => {
  it("правка — изменённые поля без служебных; автор и о ком запись", () => {
    const [entry] = journalEntries([
      record({
        changes: { founded_year: [2012, 2015], updated_at: ["a", "b"], archived_at: [null, "x"] },
      }),
    ]);
    expect(entry).toEqual({
      id: 10,
      at: "2026-10-20T09:05:00Z",
      actor: "Бахтиёр Каримов",
      action: "update",
      entity: "developers",
      subject: "Farg‘ona Sifat Qurilish",
      changes: [
        {
          field: "founded_year",
          before: { kind: "text", text: "2012" },
          after: { kind: "text", text: "2015" },
        },
      ],
      summary: null,
    });
  });

  it("добавление и удаление — без полей; правка только служебного — скрыта; чужое действие — тоже", () => {
    const entries = journalEntries([
      record({ id: 3, action: "insert", changes: { name: "X", slug: "x" } }),
      record({ id: 2, entity: "media_assets", changes: { path: ["a", "b"], blur: ["c", "d"] } }),
      record({ id: 1, action: "truncate" }),
    ]);
    expect(entries.map((entry) => [entry.id, entry.changes])).toEqual([[3, []]]);
  });

  it("«Что входит в цену» и чертёж — «изменено» без значений, но запись есть", () => {
    const entries = journalEntries([
      record({ id: 2, entity: "blocks", changes: { name: "A", price_includes: [[], [{}]] } }),
      record({ id: 1, entity: "layouts", changes: { block_id: "b", drawing_id: ["x", "y"] } }),
    ]);
    expect(
      entries.map((entry) => entry.changes.map((change) => [change.field, change.opaque])),
    ).toEqual([[["price_includes", true]], [["drawing_id", true]]]);
  });

  it("«Показать ещё» — с последней строки базы, даже если она скрыта из вида", () => {
    const records = [record({ id: 5 }), record({ id: 4, changes: { path: ["a", "b"] } })];
    expect(journalPage(records, 2).nextBefore).toBe(4);
    expect(journalPage(records, 3).nextBefore).toBeNull();
  });
});
