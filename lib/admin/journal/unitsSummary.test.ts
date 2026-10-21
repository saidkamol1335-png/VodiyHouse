import { describe, expect, it } from "vitest";
import { journalEntries, journalValue, type JournalRecord } from "./format";
import { parseUnitsSummary } from "./unitsSummary";

// Записи в той форме, что пишет база (private.write_units_summary и write_audit, шаг 12.1).
const BLOCK = "00000000-0000-4000-8000-0000000000b1";
const context = { block_id: BLOCK, block_name: "A", currency: "USD" };

const record = (
  action: string,
  changes: object,
  overrides: Partial<JournalRecord> = {},
): JournalRecord => ({
  id: 7,
  at: "2026-10-21T10:00:00Z",
  action,
  entity: "units",
  entity_id: BLOCK,
  changes: { ...context, ...changes },
  actor_name: "Дилноза Юсупова",
  subject: "Блок A",
  ...overrides,
});

const entryOf = (value: JournalRecord) => journalEntries([value])[0];

describe("журнал квартир · сводки", () => {
  it("генератор: сколько, номера, без планировки", () => {
    const summary = { kind: "create", count: 88, numbers: "1–88", unassigned: 4 };
    expect(entryOf(record("insert", { summary }))?.summary).toEqual(summary);
  });

  it("статус: группы «было → стало», у отмены — не тронутые и удалённые", () => {
    const changes = {
      status: [null, "reserved"],
      summary: {
        kind: "status",
        count: 3,
        numbers: "2–4",
        groups: [
          { from: "free", to: "reserved", count: 2, numbers: "2, 3" },
          { from: "sold", to: "reserved", count: 1, numbers: "4" },
        ],
      },
    };
    const entry = entryOf(record("update", changes));
    expect(entry?.summary).toMatchObject({ kind: "status", undo: false, skipped: 0, missing: 0 });
    expect(entry?.summary?.kind === "status" && entry.summary.groups).toHaveLength(2);
    // Смену статуса показывают группы — пара «Статус было → стало» её повторила бы.
    expect(entry?.changes).toEqual([]);

    const undo = {
      kind: "status",
      undo: true,
      count: 1,
      numbers: "5",
      groups: [],
      skipped: 1,
      missing: 1,
    };
    expect(entryOf(record("update", { summary: undo }))?.summary).toMatchObject({
      undo: true,
      skipped: 1,
      missing: 1,
    });
  });

  it("сводка без пар (стояки на разные планировки) не пропадает из журнала", () => {
    const summary = {
      kind: "layouts",
      count: 2,
      numbers: "11, 12",
      assigned: [
        { layout_id: "l1", label: "1-комн. · 42,5 м²", count: 1, numbers: "11" },
        { layout_id: null, label: null, count: 1, numbers: "12" },
      ],
    };
    const entry = entryOf(record("update", { summary }));
    expect(entry?.changes).toEqual([]);
    expect(entry?.summary).toMatchObject({
      assigned: [{ label: "1-комн. · 42,5 м²" }, { label: null }],
    });
  });

  it("цена — деньги с валютой блока; удаление — брони и продажи номерами", () => {
    const price = record("update", {
      price_per_m2: [null, 620],
      summary: {
        kind: "price",
        mode: "per_m2",
        value: 620,
        count: 4,
        numbers: "1–4",
        without_layout: 1,
      },
    });
    // «Было» пусто — у сводки это и «пусто», и «по-разному»: показываем только «стало».
    expect(entryOf(price)?.changes).toEqual([
      {
        field: "price_per_m2",
        before: { kind: "empty" },
        after: { kind: "money", amount: 620, currency: "USD", perM2: true },
        afterOnly: true,
      },
    ]);
    expect(entryOf(price)?.summary).toMatchObject({ mode: "per_m2", withoutLayout: 1 });

    const removed = record("delete", {
      summary: {
        kind: "delete_list",
        count: 16,
        numbers: "1–16",
        statuses: { free: 8, reserved: 1, sold: 7 },
        reserved_numbers: "3",
        sold_numbers: "5, 7, 9",
      },
    });
    expect(entryOf(removed)?.summary).toEqual({
      kind: "delete_list",
      count: 16,
      numbers: "1–16",
      statuses: { free: 8, reserved: 1, sold: 7 },
      reservedNumbers: "3",
      soldNumbers: "5, 7, 9",
    });
  });

  it("незнакомая или битая сводка — без неё, пары всё равно видны", () => {
    expect(parseUnitsSummary({ summary: { kind: "teleport", count: 1 } })).toBeNull();
    expect(parseUnitsSummary({ summary: "1–88" })).toBeNull();
    expect(parseUnitsSummary(null)).toBeNull();
    const entry = entryOf(record("update", { price: [30000, 31000], summary: { kind: "?" } }));
    expect(entry?.summary).toBeNull();
    expect(entry?.changes).toHaveLength(1);
  });
});

describe("журнал квартир · построчная правка", () => {
  it("номер, подпись планировки, цена с валютой; служебный layout_id скрыт", () => {
    const entry = entryOf(
      record(
        "update",
        {
          number: ["3", "3А"],
          layout_id: ["l1", "l2"],
          layout: ["1-комн. · 42,5 м²", "2-комн. · 58,7 м²"],
          price: [41000, 42000],
        },
        { entity_id: "unit-1", subject: "Блок A · кв. 3А" },
      ),
    );
    expect(entry?.summary).toBeNull();
    expect(entry?.changes.map((change) => change.field)).toEqual(["number", "layout", "price"]);
    expect(entry?.changes[2]?.after).toEqual({
      kind: "money",
      amount: 42000,
      currency: "USD",
      perM2: false,
    });
    // Правка строки — «было» как есть, даже пустое (это не сводка).
    expect(entry?.changes.every((change) => !change.afterOnly)).toBe(true);
  });

  it("отделка: у квартиры пусто — «как в блоке», у блока — «—»; id — для названия из справочника", () => {
    expect(journalValue("units", "finishing_id", null)).toEqual({
      kind: "finishing",
      id: null,
      inherit: true,
    });
    expect(journalValue("blocks", "finishing_id", null)).toEqual({
      kind: "finishing",
      id: null,
      inherit: false,
    });
    expect(journalValue("blocks", "finishing_id", 2)).toEqual({
      kind: "finishing",
      id: 2,
      inherit: false,
    });
  });
});
