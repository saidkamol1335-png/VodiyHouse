import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, isRemoteTarget, type TestDb } from "./harness";

// DEMO для стресс-теста шаблонов и нагрузки каталога (supabase/demo/stress.sql, PLAN 3а).
const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");
const readDemo = (file: string) => readFile(path.join(DEMO_DIR, file), "utf8");

describe.skipIf(isRemoteTarget)("DEMO: худший, лучший и 30 ЖК для нагрузки", () => {
  let db: TestDb;
  const count = async (sql: string) => (await db.admin.query<{ n: number }>(sql)).rows[0]?.n;

  beforeAll(async () => {
    db = await createTestDb();
    for (const file of ["remove.sql", "seed.sql", "stress.sql"]) await db.admin.exec(await readDemo(file));
  });
  afterAll(() => db.close());

  it("36 ЖК на сайте: 4 из мокапа, худший, лучший и 30 для нагрузки; у каждого — квартиры", async () => {
    expect(await count("select count(*)::int as n from complexes where slug like 'demo-%' and status = 'published'")).toBe(36);
    expect(
      await count(
        `select count(*)::int as n from complexes c where c.slug like 'demo-%' and not exists (
           select 1 from units u join blocks b on b.id = u.block_id where b.complex_id = c.id and u.status = 'free')`,
      ),
    ).toBe(0);
  });

  it("квартира — планировка своего блока; каждый пятый ЖК нагрузки — в сумах", async () => {
    expect(
      await count(
        `select count(*)::int as n from units u join layouts l on l.id = u.layout_id where l.block_id <> u.block_id`,
      ),
    ).toBe(0);
    expect(
      await count(
        `select count(*)::int as n from blocks b join complexes c on c.id = b.complex_id
         where c.slug like 'demo-load-%' and b.currency = 'UZS'`,
      ),
    ).toBe(6);
  });

  it("худший — без ориентира, 1 блок и 1 планировка; лучший — 3 блока, от студии до 5-комн.", async () => {
    const shape = async (slug: string) =>
      (
        await db.admin.query<{ blocks: number; layouts: number; min_rooms: number; max_rooms: number; landmark: unknown }>(
          `select count(distinct b.id)::int as blocks, count(distinct l.id)::int as layouts,
                  min(l.rooms)::int as min_rooms, max(l.rooms)::int as max_rooms, max(c.landmark::text) as landmark
           from complexes c join blocks b on b.complex_id = c.id join layouts l on l.block_id = b.id
           where c.slug = $1`,
          [slug],
        )
      ).rows[0]!;
    expect(await shape("demo-worst")).toMatchObject({ blocks: 1, layouts: 1, landmark: null });
    expect(await shape("demo-best")).toMatchObject({ blocks: 3, layouts: 11, min_rooms: 0, max_rooms: 5 });
  });

  it("remove.sql убирает и стресс-DEMO", async () => {
    await db.admin.exec(await readDemo("remove.sql"));
    expect(await count("select count(*)::int as n from complexes where slug like 'demo-%'")).toBe(0);
  });
});
