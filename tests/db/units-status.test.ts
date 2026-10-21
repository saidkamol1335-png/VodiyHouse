import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { createStaff, createTestDb, expectHint, user, type Db, type TestDb } from "./harness";
import {
  SMALL_PLAN,
  callAs,
  expectAvailabilityMatches,
  generate,
  lastAuditId,
  newBlock,
  newLayout,
  planRows,
  readyPublishedComplex,
  unitByNumber,
  unitEntries,
  unitsOf,
  type UnitRow,
} from "./units-fixtures";

type StatusResult = { changed: number; undo: { status: string; ids: string[] }[] };

// Шаг 12.1: статус тапом и массово, «Отменить» и журнал квартир — одна запись на действие,
// флаг сводки не утекает в следующие правки транзакции.
describe("квартиры: статус, «Отменить» и журнал", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let otherManager: string;
  let block: string;
  let oneRoom: string;
  let twoRoom: string;

  const ids_ = (units: UnitRow[]) => units.map((unit) => unit.id);

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    otherManager = await createStaff(db.admin, "manager");
    block = await newBlock(db.admin, ids.draftComplex, "С", 5);
    oneRoom = await newLayout(db.admin, block, 1, 42.5);
    twoRoom = await newLayout(db.admin, block, 2, 58.7);
    await generate(db, head, block, SMALL_PLAN, [oneRoom, twoRoom]);
  });
  afterAll(() => db.close());

  describe("статус (решение №7)", () => {
    it("тап менеджера: undo, автор, цена не тронута, одна запись с подписью квартиры", async () => {
      const unit = await unitByNumber(db.admin, block, "1");
      const since = await lastAuditId(db.admin);
      const result = await callAs<StatusResult>(
        db,
        manager,
        "set_units_status($1, $2, 'reserved')",
        [block, [unit.id]],
      );
      expect(result).toMatchObject({ changed: 1, undo: [{ status: "free", ids: [unit.id] }] });
      expect(await unitByNumber(db.admin, block, "1")).toMatchObject({
        status: "reserved",
        updated_by: manager,
        price: null,
      });

      const fresh = (await unitEntries(db.admin, block)).filter((entry) => entry.id > since);
      expect(fresh).toHaveLength(1);
      expect(fresh[0]).toMatchObject({
        action: "update",
        actor_id: manager,
        complex_id: ids.draftComplex,
        changes: {
          status: ["free", "reserved"],
          summary: { kind: "status", count: 1, numbers: "1" },
        },
      });
      const subject = await callAs<string>(
        db,
        manager,
        "(select j.subject from journal_entries(null, null, 1, $1) j)",
        [ids.draftComplex],
      );
      expect(subject).toBe("Блок С · кв. 1");

      const again = await callAs<StatusResult>(
        db,
        manager,
        "set_units_status($1, $2, 'reserved')",
        [block, [unit.id]],
      );
      expect(again.changed).toBe(0);
      expect((await unitEntries(db.admin, block)).filter((entry) => entry.id > since)).toHaveLength(
        1,
      );
    });

    it("массово по смешанной выборке — одна запись, группы и undo на каждый прежний статус", async () => {
      const [a, b, c] = await Promise.all(
        ["2", "3", "4"].map((n) => unitByNumber(db.admin, block, n)),
      );
      await callAs(db, head, "set_units_status($1, $2, 'sold')", [block, [c!.id]]);
      const since = await lastAuditId(db.admin);

      const result = await callAs<StatusResult>(
        db,
        manager,
        "set_units_status($1, $2, 'reserved')",
        [block, [a!.id, b!.id, c!.id]],
      );
      expect(result.changed).toBe(3);
      expect(result.undo).toEqual([
        { status: "free", ids: expect.arrayContaining([a!.id, b!.id]) },
        { status: "sold", ids: [c!.id] },
      ]);
      const fresh = (await unitEntries(db.admin, block)).filter((entry) => entry.id > since);
      expect(fresh).toHaveLength(1);
      expect(fresh[0]?.changes).toMatchObject({
        status: [null, "reserved"],
        summary: {
          count: 3,
          numbers: "2–4",
          groups: [
            { from: "free", to: "reserved", count: 2, numbers: "2, 3" },
            { from: "sold", to: "reserved", count: 1, numbers: "4" },
          ],
        },
      });
      // Сводка на несколько квартир подписана блоком, без «кв.».
      const subject = await callAs<string>(
        db,
        manager,
        "(select j.subject from journal_entries(null, null, 1, $1) j)",
        [ids.draftComplex],
      );
      expect(subject).toBe("Блок С");

      // «Отменить»: каждой квартире — её прежний статус; исходная запись остаётся.
      const reverted = await callAs(db, manager, "revert_units_status($1, 'reserved', $2::jsonb)", [
        block,
        JSON.stringify(result.undo),
      ]);
      expect(reverted).toEqual({
        complex_id: ids.draftComplex,
        reverted: 3,
        skipped: [],
        missing: 0,
      });
      expect((await unitByNumber(db.admin, block, "2")).status).toBe("free");
      expect((await unitByNumber(db.admin, block, "4")).status).toBe("sold");
      const after = (await unitEntries(db.admin, block)).filter((entry) => entry.id > since);
      expect(after).toHaveLength(2);
      // Разное «стало» (свободна и продана) — без пары: «бронь → —» читалось бы как «статус сняли».
      expect(after[1]?.changes).not.toHaveProperty("status");
      expect(after[1]?.changes).toMatchObject({
        summary: { undo: true, count: 3, skipped: 0, missing: 0 },
      });
      await expectAvailabilityMatches(db, manager, ids.draftComplex);
    });

    it("«Отменить» не затирает чужую правку и считает удалённые квартиры", async () => {
      const [a, b, c] = await Promise.all(
        ["5", "6", "7"].map((n) => unitByNumber(db.admin, block, n)),
      );
      const result = await callAs<StatusResult>(
        db,
        manager,
        "set_units_status($1, $2, 'reserved')",
        [block, [a!.id, b!.id, c!.id]],
      );
      await callAs(db, otherManager, "set_units_status($1, $2, 'sold')", [block, [b!.id]]);
      await callAs(db, head, "delete_units($1, $2)", [block, [c!.id]]);

      const reverted = await callAs(db, manager, "revert_units_status($1, 'reserved', $2::jsonb)", [
        block,
        JSON.stringify(result.undo),
      ]);
      expect(reverted).toMatchObject({ reverted: 1, skipped: ["6"], missing: 1 });
      expect((await unitByNumber(db.admin, block, "5")).status).toBe("free");
      expect((await unitByNumber(db.admin, block, "6")).status).toBe("sold");
      // Одно «стало» — пара есть.
      expect((await unitEntries(db.admin, block)).at(-1)?.changes).toMatchObject({
        status: ["reserved", "free"],
        summary: { undo: true, count: 1, skipped: 1, missing: 1 },
      });
    });

    it("квартира чужого блока или слишком большой список — отказ без изменений", async () => {
      const own = await unitByNumber(db.admin, block, "8");
      await expectHint(
        callAs(db, manager, "set_units_status($1, $2, 'sold')", [block, [own.id, ids.units[0]]]),
        "vh:not_found",
      );
      expect((await unitByNumber(db.admin, block, "8")).status).toBe("free");
      const many = Array.from({ length: 5001 }, () => crypto.randomUUID());
      await expectHint(
        callAs(db, manager, "set_units_status($1, $2, 'sold')", [block, many]),
        "vh:invalid",
      );
      await expectHint(
        callAs(db, manager, "revert_units_status($1, 'sold', $2::jsonb)", [
          block,
          '[{"status": "sold", "ids": []}]',
        ]),
        "vh:invalid",
      );
      await expectHint(
        callAs(db, manager, "set_units_status($1, $2, null)", [block, [own.id]]),
        "vh:invalid",
      );
      const twice = JSON.stringify([
        { status: "free", ids: [own.id] },
        { status: "reserved", ids: [own.id] },
      ]);
      await expectHint(
        callAs(db, manager, "revert_units_status($1, 'sold', $2::jsonb)", [block, twice]),
        "vh:invalid",
      );
      expect((await unitByNumber(db.admin, block, "8")).status).toBe("free");
    });

    it("продать последнюю свободную в опубликованном ЖК можно всегда", async () => {
      const ready = await readyPublishedComplex(db.admin, ids.publicDeveloper, "ready-sold");
      await generate(db, head, ready.blockId, { ...SMALL_PLAN, unitsPerFloor: [1, 1] }, [
        ready.layoutId,
      ]);
      const all = ids_(await unitsOf(db.admin, ready.blockId));
      expect(
        await callAs(db, manager, "set_units_status($1, $2, 'sold')", [ready.blockId, all]),
      ).toMatchObject({ changed: 8 });
    });
  });

  describe("журнал", () => {
    it("флаг сводки не утекает: следующие правки той же транзакции пишутся построчно", async () => {
      const units = await unitsOf(db.admin, block);
      const probe = units.at(-1)!;
      // Каждый пакет действительно что-то меняет у квартиры № 3 (свободна, 1-комн., без отделки).
      const target = await unitByNumber(db.admin, block, "3");
      expect(target).toMatchObject({ status: "free", layout_id: oneRoom, finishing_id: null });
      const whiteBox = (
        await db.admin.query<{ id: number }>("select id from finishings where slug = 'white-box'")
      ).rows[0]!.id;
      const fresh = await newBlock(db.admin, ids.draftComplex, "Ф", 5);
      const listed = await newBlock(db.admin, ids.draftComplex, "Д", 5);
      await generate(db, head, listed, SMALL_PLAN);
      const call = (tx: Db, expr: string, params: unknown[]) =>
        tx.query<{ result: { undo?: unknown } }>(`select ${expr} as result`, params);
      const freshRows = JSON.stringify(planRows(fresh, SMALL_PLAN));
      const toTwoRoom = JSON.stringify([{ id: target.id, layout_id: twoRoom }]);
      const batches: [string, (tx: Db) => Promise<unknown>][] = [
        [
          "create_block_units",
          (tx) => call(tx, "create_block_units($1, $2::jsonb)", [fresh, freshRows]),
        ],
        [
          "set_units_status",
          (tx) => call(tx, "set_units_status($1, $2, 'reserved')", [block, [target.id]]),
        ],
        [
          "revert_units_status",
          async (tx) => {
            const sold = await call(tx, "set_units_status($1, $2, 'sold')", [block, [target.id]]);
            const undo = JSON.stringify(sold.rows[0]!.result.undo);
            return call(tx, "revert_units_status($1, 'sold', $2::jsonb)", [block, undo]);
          },
        ],
        [
          "set_units_price",
          (tx) => call(tx, "set_units_price($1, $2, 'total', 50000)", [block, [target.id]]),
        ],
        [
          "set_units_finishing",
          (tx) =>
            call(tx, "set_units_finishing($1, $2, $3::smallint)", [block, [target.id], whiteBox]),
        ],
        [
          "set_units_layouts",
          (tx) => call(tx, "set_units_layouts($1, $2::jsonb)", [block, toTwoRoom]),
        ],
        ["delete_units", (tx) => call(tx, "delete_units($1, $2)", [block, [units[1]!.id]])],
        ["delete_block_units", (tx) => call(tx, "delete_block_units($1, 'Д')", [listed])],
      ];
      for (const [index, [name, batch]] of batches.entries()) {
        const since = await lastAuditId(db.admin);
        const flag = await db.as(user(head), async (tx) => {
          await batch(tx);
          await tx.query("select update_unit($1, $2, $3::jsonb)", [
            block,
            probe.id,
            JSON.stringify({ number: `П${index}` }),
          ]);
          await tx.query("update layouts set price_from = $2 where id = $1", [
            oneRoom,
            1000 + index,
          ]);
          const setting = await tx.query<{ flag: string | null }>(
            "select current_setting('vodiy.units_summary', true) as flag",
          );
          return setting.rows[0]?.flag;
        });
        expect(flag, name).not.toBe("on");
        const entries = await db.admin.query<{
          entity: string;
          entity_id: string;
          summary: boolean;
        }>(
          "select entity, entity_id, changes ? 'summary' as summary from audit_log where id > $1 order by id",
          [since],
        );
        // Сводка пакета, затем построчная правка квартиры и правка планировки.
        expect(
          entries.rows.some((row) => row.summary),
          name,
        ).toBe(true);
        expect(entries.rows.slice(-2), name).toEqual([
          { entity: "units", entity_id: probe.id, summary: false },
          { entity: "layouts", entity_id: oneRoom, summary: false },
        ]);
      }
    });

    it("флаг возвращается к прежнему значению, а не выключается", async () => {
      const unit = await unitByNumber(db.admin, block, "12");
      const flag = await db.as(user(head), async (tx) => {
        await tx.query("select set_config('vodiy.units_summary', 'on', true)");
        await tx.query("select set_units_status($1, $2, 'sold')", [block, [unit.id]]);
        const setting = await tx.query<{ flag: string }>(
          "select current_setting('vodiy.units_summary', true) as flag",
        );
        await tx.query("select set_config('vodiy.units_summary', '', true)");
        return setting.rows[0]?.flag;
      });
      expect(flag).toBe("on");
    });

    it("DEMO-режим журнала (skip_audit) глушит и сводки; у сводок всегда есть ЖК", async () => {
      const since = await lastAuditId(db.admin);
      const unit = await unitByNumber(db.admin, block, "13");
      await db.as(user(head), async (tx) => {
        await tx.query("select set_config('vodiy.skip_audit', 'on', true)");
        await tx.query("select set_units_status($1, $2, 'sold')", [block, [unit.id]]);
        // В облачном прогоне настройка пережила бы точку сохранения и выключила журнал файла.
        await tx.query("select set_config('vodiy.skip_audit', '', true)");
      });
      expect(await lastAuditId(db.admin)).toBe(since);
      const orphan = await db.admin.query<{ n: number }>(
        "select count(*)::int as n from audit_log where entity = 'units' and complex_id is null",
      );
      expect(orphan.rows[0]?.n).toBe(0);
    });

    it("номера в сводке: сплошной ряд, перечисление, «и ещё N», буквы, ведущие нули", async () => {
      const label = async (numbers: string[], limit: number | null = 20) =>
        (
          await db.admin.query<{ label: string | null }>(
            "select private.unit_numbers_label($1, $2) as label",
            [numbers, limit],
          )
        ).rows[0]?.label;
      expect(await label(["3", "1", "2"])).toBe("1–3");
      expect(await label(["1", "2"])).toBe("1, 2");
      expect(await label(["10", "2", "12А", "12"])).toBe("2, 10, 12, 12А");
      expect(await label(["1", "3", "5"], 2)).toBe("1, 3 и ещё 1");
      expect(await label(["1", "01", "3"])).toBe("01, 1, 3");
      expect(await label(["010", "011", "012"])).toBe("010, 011, 012");
      expect(await label([])).toBeNull();
    });

    it("при удалении номера брони и продаж — все, без «и ещё N»", async () => {
      const gone = Array.from({ length: 25 }, (_, index) => ({
        number: String(index * 2 + 1),
        status: "sold",
      }));
      const { rows } = await db.admin.query<{ summary: { sold_numbers: string; numbers: string } }>(
        "select private.removed_units_summary('delete', $1::jsonb) as summary",
        [JSON.stringify(gone)],
      );
      expect(rows[0]?.summary.sold_numbers).toBe(gone.map((unit) => unit.number).join(", "));
      expect(rows[0]?.summary.numbers).toMatch(/и ещё 5$/);
    });
  });

  it("на свежем соединении правка квартиры пишется в журнал (флаг ещё не задан)", async () => {
    const clean = await createTestDb();
    try {
      const fixtures = await seedContent(clean.admin);
      const boss = await createStaff(clean.admin, "head");
      await clean.as(user(boss), (tx) =>
        tx.query('select update_unit($1, $2, \'{"number": "1А"}\'::jsonb)', [
          fixtures.publicBlock,
          fixtures.units[0],
        ]),
      );
      const { rows } = await clean.admin.query<{ action: string }>(
        "select action from audit_log where entity = 'units' and entity_id = $1",
        [fixtures.units[0]],
      );
      expect(rows.map((row) => row.action)).toEqual(["insert", "update"]);
    } finally {
      await clean.close();
    }
  });
});
