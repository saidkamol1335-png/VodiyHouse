import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectDenied, user, type TestDb } from "./harness";

type UnitRow = { status: string; price: string | null; updated_by: string | null };

// Блоки, планировки, квартиры — PLAN §3.1, §5, §7: менеджер меняет только статус, каждое
// изменение — в журнал; посетитель квартиры напрямую не читает.
describe("блоки, планировки и квартиры", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
  });
  afterAll(() => db.close());

  const unit = async (id: string) =>
    (
      await db.admin.query<UnitRow>("select status, price, updated_by from units where id = $1", [
        id,
      ])
    ).rows[0];

  it("сайт видит блоки и планировки только опубликованных ЖК", async () => {
    const blocks = await db.as(anon, (tx) => tx.query<{ id: string }>("select id from blocks"));
    expect(blocks.rows.map((row) => row.id)).toEqual([ids.publicBlock]);
    const layouts = await db.as(anon, (tx) => tx.query<{ id: string }>("select id from layouts"));
    expect(layouts.rows.map((row) => row.id).sort()).toEqual(
      [ids.oneRoomLayout, ids.twoRoomLayout].sort(),
    );
  });

  it("квартиры посетителю напрямую закрыты — ни строк, ни полей сотрудников", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select id from units")));
    await expectDenied(db.as(anon, (tx) => tx.query("select updated_by from units")));
  });

  it("сотрудники читают квартиры", async () => {
    for (const id of [head, manager, videographer]) {
      const { rows } = await db.as(user(id), (tx) => tx.query("select id from units"));
      expect(rows).toHaveLength(4);
    }
  });

  it("менеджер не правит квартиру напрямую — ни статус, ни цену", async () => {
    const [first] = ids.units;
    for (const sql of [
      "update units set status = 'sold' where id = $1",
      "update units set price = 1 where id = $1",
    ]) {
      const result = await db.as(user(manager), (tx) => tx.query(sql, [first]));
      expect(result.affectedRows).toBe(0);
    }
    expect(await unit(first!)).toMatchObject({ status: "free", price: "30000.00" });
  });

  it("менеджер меняет статус через функцию: автор и журнал с ЖК", async () => {
    const [first, second] = ids.units;
    const changed = await db.as(user(manager), (tx) =>
      tx.query<{ changed: number }>("select set_units_status($1, 'reserved') as changed", [
        [first, second],
      ]),
    );
    expect(changed.rows[0]?.changed).toBe(2);
    expect(await unit(first!)).toMatchObject({ status: "reserved", updated_by: manager });

    const log = await db.admin.query<{ actor_id: string; complex_id: string; changes: unknown }>(
      "select actor_id, complex_id, changes from audit_log where entity = 'units' and entity_id = $1",
      [first],
    );
    expect(log.rows.at(-1)).toEqual({
      actor_id: manager,
      complex_id: ids.publicComplex,
      changes: { status: ["free", "reserved"] },
    });
  });

  it("повторная установка того же статуса ничего не меняет", async () => {
    const [first] = ids.units;
    const changed = await db.as(user(manager), (tx) =>
      tx.query<{ changed: number }>("select set_units_status($1, 'reserved') as changed", [
        [first],
      ]),
    );
    expect(changed.rows[0]?.changed).toBe(0);
  });

  it("видеограф и посетитель статус не меняют", async () => {
    const call = "select set_units_status($1, 'sold')";
    await expect(
      db.as(user(videographer), (tx) => tx.query(call, [[ids.units[0]]])),
    ).rejects.toThrow(/руководитель и менеджер/);
    await expectDenied(db.as(anon, (tx) => tx.query(call, [[ids.units[0]]])));
  });

  it("руководитель правит цену и отделку; цена — целиком или за м², не обе", async () => {
    const [, , third] = ids.units;
    await db.as(user(head), (tx) =>
      tx.query(
        "update units set price = null, price_per_m2 = 700, finishing_id = (select id from finishings where slug = 'white-box') where id = $1",
        [third],
      ),
    );
    expect(await unit(third!)).toMatchObject({ price: null, updated_by: head });
    await expect(
      db.as(user(head), (tx) => tx.query("update units set price = 50000 where id = $1", [third])),
    ).rejects.toThrow(/check constraint/);
  });

  it("позиция на этаже и номер квартиры в блоке уникальны", async () => {
    const insert = (position: number, number: string) =>
      db.as(user(head), (tx) =>
        tx.query(
          "insert into units (block_id, entrance, floor, position, number) values ($1, 1, 2, $2, $3)",
          [ids.publicBlock, position, number],
        ),
      );
    await expect(insert(1, "99")).rejects.toThrow(/duplicate key/);
    await expect(insert(9, "1")).rejects.toThrow(/duplicate key/);
    await insert(9, "12А");
  });

  it("правка планировки попадает в журнал своего ЖК", async () => {
    await db.as(user(head), (tx) =>
      tx.query("update layouts set price_from = 31000 where id = $1", [ids.oneRoomLayout]),
    );
    const { rows } = await db.admin.query<{ complex_id: string; actor_id: string }>(
      "select complex_id, actor_id from audit_log where entity = 'layouts' order by id desc limit 1",
    );
    expect(rows[0]).toEqual({ complex_id: ids.publicComplex, actor_id: head });
  });

  it("менеджер не создаёт и не удаляет блоки, планировки и квартиры", async () => {
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query("insert into blocks (complex_id, name) values ($1, 'C')", [ids.publicComplex]),
      ),
    );
    const removed = await db.as(user(manager), (tx) =>
      tx.query("delete from units where block_id = $1", [ids.publicBlock]),
    );
    expect(removed.affectedRows).toBe(0);
  });

  it("удаление блока удаляет его квартиры и планировки", async () => {
    await db.as(user(head), (tx) => tx.query("delete from blocks where id = $1", [ids.draftBlock]));
    const left = await db.admin.query("select id from layouts where block_id = $1", [
      ids.draftBlock,
    ]);
    expect(left.rows).toEqual([]);
  });
});
