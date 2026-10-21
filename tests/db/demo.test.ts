import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateUnits } from "@/lib/units";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, isRemoteTarget, user, type TestDb } from "./harness";

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");
const readDemo = (file: string) => readFile(path.join(DEMO_DIR, file), "utf8");

// «Остатки по ЖК» на главной кабинета в мокапе (cabinet-1440/CabHome): свободно по типам.
const MOCKUP_FREE: Record<string, Record<number, number>> = {
  "demo-shodlik": { 1: 14, 2: 22, 3: 5 },
  "demo-namuna": { 0: 13, 1: 18, 2: 18, 3: 13, 4: 3 },
  "demo-yulduz": { 1: 15, 2: 15, 3: 12, 4: 1 },
  "demo-orzu": { 0: 7, 1: 10, 2: 3, 3: 7 },
};

// Параметры генератора DEMO-блоков — те же, что в supabase/demo/seed.sql (demo_block_plan).
const DEMO_BLOCKS = [
  { complex: "demo-shodlik", block: "A", entrances: 2, floors: 12, perFloor: 4 },
  { complex: "demo-shodlik", block: "B", entrances: 2, floors: 12, perFloor: 4 },
  { complex: "demo-namuna", block: "1", entrances: 2, floors: 16, perFloor: 4 },
  { complex: "demo-yulduz", block: "1", entrances: 2, floors: 18, perFloor: 3 },
  { complex: "demo-orzu", block: "1", entrances: 2, floors: 10, perFloor: 3 },
  { complex: "demo-orzu", block: "2", entrances: 2, floors: 10, perFloor: 3 },
];

// В облаке DEMO проверяет сама команда npm run demo:seed (её SQL фиксирует транзакцию).
describe.skipIf(isRemoteTarget)("DEMO-данные", () => {
  let db: TestDb;
  let real: ContentIds;
  let manager: string;

  const seed = async () => {
    await db.admin.exec(await readDemo("remove.sql"));
    await db.admin.exec(await readDemo("seed.sql"));
  };
  const count = async (sql: string) => (await db.admin.query<{ n: number }>(sql)).rows[0]?.n;
  const demoCounts = async () => ({
    developers: await count("select count(*)::int as n from developers where slug like 'demo-%'"),
    complexes: await count("select count(*)::int as n from complexes where slug like 'demo-%'"),
    units: await count(
      `select count(*)::int as n from units u join blocks b on b.id = u.block_id
       join complexes c on c.id = b.complex_id where c.slug like 'demo-%'`,
    ),
  });
  const complexId = async (slug: string) =>
    (await db.admin.query<{ id: string }>("select id from complexes where slug = $1", [slug]))
      .rows[0]!.id;

  beforeAll(async () => {
    db = await createTestDb();
    real = await seedContent(db.admin);
    manager = await createStaff(db.admin, "manager");
    await seed();
  });
  afterAll(() => db.close());

  it("3 застройщика, 4 ЖК, 506 квартир — все с планировкой", async () => {
    expect(await demoCounts()).toEqual({ developers: 3, complexes: 4, units: 506 });
    expect(
      await count(
        `select count(*)::int as n from units u join blocks b on b.id = u.block_id
         join complexes c on c.id = b.complex_id where c.slug like 'demo-%' and u.layout_id is null`,
      ),
    ).toBe(0);
  });

  it("свободные квартиры по типам — как в «Остатках по ЖК» мокапа, сайт их видит", async () => {
    for (const [slug, expected] of Object.entries(MOCKUP_FREE)) {
      const id = await complexId(slug);
      const actual = await db.as(anon, (tx) =>
        tx.query<{ rooms: number; free_count: number }>(
          "select rooms, free_count from room_availability($1) order by rooms",
          [[id]],
        ),
      );
      expect(Object.fromEntries(actual.rows.map((row) => [row.rooms, row.free_count]))).toEqual(
        expected,
      );
    }
  });

  it("Shodlik по блокам — как в мокапе: «Бл. A: 12 · Бл. B: 29»", async () => {
    const shodlik = await complexId("demo-shodlik");
    const blocks = await db.as(anon, (tx) =>
      tx.query<{ name: string; free_count: number }>(
        "select name, free_count from block_availability($1)",
        [shodlik],
      ),
    );
    expect(blocks.rows).toEqual([
      { name: "A", free_count: 12 },
      { name: "B", free_count: 29 },
    ]);
  });

  it("нумерация DEMO совпадает с генератором lib/units", async () => {
    for (const plan of DEMO_BLOCKS) {
      const expected = generateUnits({
        entrances: plan.entrances,
        floors: plan.floors,
        firstResidentialFloor: 2,
        unitsPerFloor: Array(plan.entrances).fill(plan.perFloor),
        startNumber: 1,
      });
      const { rows } = await db.admin.query<{
        entrance: number;
        floor: number;
        position: number;
        number: string;
      }>(
        `select u.entrance, u.floor, u.position, u.number
         from units u join blocks b on b.id = u.block_id join complexes c on c.id = b.complex_id
         where c.slug = $1 and b.name = $2
         order by u.entrance, u.floor, u.position`,
        [plan.complex, plan.block],
      );
      expect(rows).toEqual(expected);
    }
  });

  it("сид не пишет в журнал; повторный сид не плодит дубли", async () => {
    // Записи о настоящих фикстурах есть; о DEMO — ни одной.
    const demoEntries = () =>
      count(
        `select count(*)::int as n from audit_log
         where complex_id in (select id from complexes where slug like 'demo-%')
            or entity_id in (select id::text from developers where slug like 'demo-%')`,
      );
    expect(await count("select count(*)::int as n from audit_log")).toBeGreaterThan(0);
    expect(await demoEntries()).toBe(0);
    await seed();
    expect(await demoEntries()).toBe(0);
    expect(await demoCounts()).toEqual({ developers: 3, complexes: 4, units: 506 });
  });

  it("удаление убирает DEMO целиком, включая журнал правок DEMO, и не трогает настоящие данные", async () => {
    const shodlik = (
      await db.admin.query<{ id: string; block_id: string }>(
        `select u.id, u.block_id from units u join blocks b on b.id = u.block_id join complexes c on c.id = b.complex_id
         where c.slug = 'demo-shodlik' and u.status = 'free' limit 1`,
      )
    ).rows[0]!;
    await db.as(user(manager), (tx) =>
      tx.query("select set_units_status($1, $2, 'reserved')", [shodlik.block_id, [shodlik.id]]),
    );
    await db.as(user(manager), (tx) =>
      tx.query("select set_units_status($1, $2, 'sold')", [real.publicBlock, [real.units[0]]]),
    );
    const realEntriesBefore = await count(
      `select count(*)::int as n from audit_log where complex_id = '${real.publicComplex}'`,
    );

    await db.admin.exec(await readDemo("remove.sql"));

    expect(await demoCounts()).toEqual({ developers: 0, complexes: 0, units: 0 });
    // Каскад: остались только блоки, планировки и сданные объекты настоящих данных (фикстуры).
    expect(await count("select count(*)::int as n from blocks")).toBe(2);
    expect(await count("select count(*)::int as n from layouts")).toBe(2);
    expect(await count("select count(*)::int as n from developer_past_projects")).toBe(2);
    // Сводка смены статуса привязана к блоку и ЖК DEMO — уходит вместе с ними.
    expect(
      await count(
        `select count(*)::int as n from audit_log
         where entity = 'units' and entity_id = '${shodlik.block_id}'`,
      ),
    ).toBe(0);
    expect(await count("select count(*)::int as n from complexes")).toBe(4);
    expect(
      await count(
        `select count(*)::int as n from audit_log where complex_id = '${real.publicComplex}'`,
      ),
    ).toBe(realEntriesBefore);
  });

  it("удалённые из кабинета сданные объекты DEMO уходят из журнала вместе с DEMO", async () => {
    await seed();
    const head = await createStaff(db.admin, "head");
    const sifat = (await db.admin.query<{ id: string }>("select id from developers where slug = 'demo-sifat'")).rows[0]!.id;
    await db.as(user(head), (tx) => tx.query("select save_developer_past_projects($1, '[]')", [sifat]));
    const logged = `select count(*)::int as n from audit_log where developer_id = '${sifat}'`;
    expect(await count(logged)).toBeGreaterThan(0);

    await db.admin.exec(await readDemo("remove.sql"));
    expect(await count(logged)).toBe(0);
  });

  it("настоящий ЖК у DEMO-застройщика останавливает удаление — ничего не удаляется", async () => {
    await seed();
    await db.admin.query(
      `insert into complexes (developer_id, slug, name)
       select id, 'real-zhk', '{"ru": "Настоящий", "uz": "Haqiqiy"}' from developers where slug = 'demo-kamalak'`,
    );
    await expect(db.admin.exec(await readDemo("remove.sql"))).rejects.toThrow(
      /удаление DEMO остановлено/,
    );
    await db.admin.exec("rollback");
    expect(await demoCounts()).toEqual({ developers: 3, complexes: 4, units: 506 });
  });
});
