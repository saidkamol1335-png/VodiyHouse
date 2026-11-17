import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, isRemoteTarget, MIGRATIONS_DIR, type TestDb } from "./harness";

// 20261117160000 (ревью блока C): пункты «Деталей проекта» с sort = 0 (сохранены до карусели) получают
// порядок сайта — по теме; ЖК, где порядок уже задан в кабинете, не трогаются.

const DEMO_SEED = path.resolve(import.meta.dirname, "../../../../supabase/demo/seed.sql");
const BACKFILL = path.join(MIGRATIONS_DIR, "20261117160000_complex_details_sort_backfill.sql");

describe.skipIf(isRemoteTarget)("«Детали проекта»: порядок старых пунктов", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(DEMO_SEED, "utf8"));
  });
  afterAll(() => db.close());

  it("sort = 0 у всех пунктов ЖК → порядок тем; заданный порядок остаётся", async () => {
    // ЖК с несколькими пунктами — «старый»; любой другой ЖК с пунктами — «порядок задан в кабинете».
    const old = (
      await db.admin.query<{ id: string }>("select complex_id as id from complex_details group by complex_id order by count(*) desc limit 1")
    ).rows[0]!.id;
    const custom = (await db.admin.query<{ id: string }>("select id from complexes where id <> $1 order by id limit 1", [old])).rows[0]!.id;
    await db.admin.query(
      `insert into complex_details (complex_id, topic_id, text)
       select $1, t.id, '{"ru": "Пункт", "uz": "Band"}' from detail_topics t order by t.sort limit 2`,
      [custom],
    );
    await db.admin.query("update complex_details set sort = 0 where complex_id = $1", [old]);
    await db.admin.query(
      "update complex_details d set sort = 1000 - t.sort from detail_topics t where t.id = d.topic_id and d.complex_id = $1",
      [custom],
    );
    const before = await db.admin.query<{ id: string; sort: number }>("select id, sort from complex_details where complex_id = $1 order by id", [custom]);

    await db.admin.exec(await readFile(BACKFILL, "utf8"));

    const { rows } = await db.admin.query<{ sort: number; topic: number }>(
      `select d.sort, t.sort as topic from complex_details d join detail_topics t on t.id = d.topic_id
        where d.complex_id = $1 order by d.sort`,
      [old],
    );
    expect(rows.map((row) => row.sort)).toEqual(rows.map((_, index) => (index + 1) * 10));
    expect(rows.map((row) => row.topic)).toEqual([...rows.map((row) => row.topic)].sort((a, b) => a - b));
    const after = await db.admin.query<{ id: string; sort: number }>("select id, sort from complex_details where complex_id = $1 order by id", [custom]);
    expect(after.rows).toEqual(before.rows);
  });
});
