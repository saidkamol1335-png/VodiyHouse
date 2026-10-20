import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  UNIT_STATUSES,
  applyRisers,
  defaultRisers,
  generateUnits,
  toUnitInsertRows,
  type BlockPlan,
} from "@/lib/units";
import { seedContent, type ContentIds } from "./content-fixtures";
import { createStaff, createTestDb, user, type Db, type TestDb } from "./harness";

// Приёмка фазы 1: блок 16 эт. × 3 подъезда × 4 кв. создаётся генератором; здесь — та часть,
// что идёт в базу: строки генератора проходят ограничения и права руководителя.
const PLAN: BlockPlan = {
  entrances: 3,
  floors: 16,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4, 4],
  startNumber: 1,
};

async function insertUnits(tx: Db, rows: unknown[]): Promise<number> {
  const result = await tx.query(
    `insert into units (block_id, layout_id, entrance, floor, "position", number)
     select r.block_id, r.layout_id, r.entrance, r.floor, r."position", r.number
     from jsonb_to_recordset($1::jsonb)
       as r(block_id uuid, layout_id uuid, entrance smallint, floor smallint, "position" smallint, number text)`,
    [JSON.stringify(rows)],
  );
  return result.affectedRows ?? 0;
}

describe("генератор блока → база", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
  });
  afterAll(() => db.close());

  it("статусы квартиры в коде и в базе совпадают", async () => {
    const { rows } = await db.admin.query<{ value: string }>(
      "select unnest(enum_range(null::unit_status))::text as value",
    );
    expect(rows.map((row) => row.value)).toEqual([...UNIT_STATUSES]);
  });

  it("руководитель создаёт блок 16 × 3 × 4 со стояками одной транзакцией", async () => {
    const started = performance.now();
    const { blockId, inserted } = await db.as(user(head), async (tx) => {
      const block = await tx.query<{ id: string }>(
        "insert into blocks (complex_id, name, floors_total) values ($1, 'Генератор', 16) returning id",
        [ids.publicComplex],
      );
      const blockId = block.rows[0]!.id;
      const layoutIds: string[] = [];
      for (const [rooms, area] of [
        [1, 42.5],
        [2, 58.7],
        [2, 61],
        [3, 78],
      ]) {
        const layout = await tx.query<{ id: string }>(
          "insert into layouts (block_id, rooms, area) values ($1, $2, $3) returning id",
          [blockId, rooms, area],
        );
        layoutIds.push(layout.rows[0]!.id);
      }
      const risers = defaultRisers(PLAN).map((riser, index) => ({
        ...riser,
        layoutId: layoutIds[index]!,
      }));
      const rows = toUnitInsertRows(blockId, applyRisers(generateUnits(PLAN), risers));
      return { blockId, inserted: await insertUnits(tx, rows) };
    });
    const elapsed = performance.now() - started;

    expect(inserted).toBe(180);
    // Запас к приёмке «< 1 мин»: база тратит доли секунды, остальное — время человека.
    expect(elapsed).toBeLessThan(5_000);

    const byRooms = await db.as(user(head), (tx) =>
      tx.query<{ rooms: number; free_count: number }>(
        "select rooms, sum(free_count)::int as free_count from layout_availability($1) where block_id = $2 group by rooms order by rooms",
        [ids.publicComplex, blockId],
      ),
    );
    expect(byRooms.rows).toEqual([
      { rooms: 1, free_count: 45 },
      { rooms: 2, free_count: 90 },
      { rooms: 3, free_count: 45 },
    ]);

    const journal = await db.admin.query<{ n: number }>(
      "select count(*)::int as n from audit_log where entity = 'units' and action = 'insert' and complex_id = $1",
      [ids.publicComplex],
    );
    expect(journal.rows[0]?.n).toBeGreaterThanOrEqual(180);
  });

  it("второй прогон генератора в тот же блок отклоняется базой — номера заняты", async () => {
    const block = await db.admin.query<{ id: string }>(
      "select id from blocks where name = 'Генератор'",
    );
    const blockId = block.rows[0]!.id;
    const rows = toUnitInsertRows(blockId, applyRisers(generateUnits(PLAN), []));
    await expect(db.as(user(head), (tx) => insertUnits(tx, rows))).rejects.toThrow(/duplicate key/);
  });
});
