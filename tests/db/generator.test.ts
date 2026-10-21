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
import { createStaff, createTestDb, expectHint, user, type Db, type TestDb } from "./harness";

// Приёмка фазы 1: блок 16 эт. × 3 подъезда × 4 кв. создаётся генератором; здесь — та часть,
// что идёт в базу: строки генератора проходят ограничения и права руководителя.
const PLAN: BlockPlan = {
  entrances: 3,
  floors: 16,
  firstResidentialFloor: 2,
  unitsPerFloor: [4, 4, 4],
  startNumber: 1,
};

// Генератор создаёт список функцией базы (Н6): строки считает lib/units, база проверяет и
// вставляет одной транзакцией.
async function createBlockUnits(tx: Db, blockId: string, rows: unknown[]): Promise<number> {
  const result = await tx.query<{ created: number }>(
    "select (create_block_units($1, $2::jsonb) ->> 'created')::int as created",
    [blockId, JSON.stringify(rows)],
  );
  return result.rows[0]!.created;
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
        "insert into blocks (complex_id, name, floors_total) values ($1, 'Г', 16) returning id",
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
      const rows = toUnitInsertRows(applyRisers(generateUnits(PLAN), risers));
      return { blockId, inserted: await createBlockUnits(tx, blockId, rows) };
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

    // Одна запись на действие, а не 180 (решение «Решаю сам» шага 12).
    const journal = await db.admin.query<{ action: string; changes: { summary: unknown } }>(
      `select a.action, a.changes from audit_log a
       where a.entity = 'units' and a.complex_id = $1
         and (a.entity_id = $2 or a.changes ->> 'block_id' = $2)`,
      [ids.publicComplex, blockId],
    );
    expect(journal.rows).toEqual([
      expect.objectContaining({
        action: "insert",
        changes: expect.objectContaining({
          summary: { kind: "create", count: 180, numbers: "1–180", unassigned: 0 },
        }),
      }),
    ]);
  });

  it("второй прогон генератора в тот же блок отклоняется — список уже есть", async () => {
    const block = await db.admin.query<{ id: string }>(
      "select id from blocks where name = 'Г'",
    );
    const blockId = block.rows[0]!.id;
    const rows = toUnitInsertRows(applyRisers(generateUnits(PLAN), []));
    await expectHint(
      db.as(user(head), (tx) => createBlockUnits(tx, blockId, rows)),
      "vh:list_exists",
    );
    const left = await db.admin.query<{ n: number }>(
      "select count(*)::int as n from units where block_id = $1",
      [blockId],
    );
    expect(left.rows[0]?.n).toBe(180);
  });
});
