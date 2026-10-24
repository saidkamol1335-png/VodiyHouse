import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 2.7: «Расчёт для этой квартиры» — site_layout_calc() на DEMO-сиде: планировка опубликованного
// ЖК, её свободные квартиры с ценой и программы её блока — без полей скидки (PLAN §3.13).

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type FlatCalc = {
  rate: { usd_uzs: number } | null;
  developer: { name: string; checked_at: string | null };
  complex: { id: string; name: { ru: string } };
  block: { id: string; name: string; currency: string };
  layout: { id: string; rooms: number; area: number; price_from: number | null };
  units: { id: string; number: string; floor: number; price: number | null }[];
  programs: { id: string; blocks_scope: string; block_ids: string[] }[];
} | null;

describe.skipIf(isRemoteTarget)("расчёт квартиры: данные для сайта", () => {
  let db: TestDb;
  let layoutId: string;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
    // Планировка опубликованного ЖК, у которой есть и свободные, и занятые квартиры.
    const { rows } = await db.admin.query<{ id: string }>(
      `select l.id from layouts l
         join blocks b on b.id = l.block_id
        where private.is_public_complex(b.complex_id)
          and exists (select 1 from units u where u.layout_id = l.id and u.status = 'free')
          and exists (select 1 from units u where u.layout_id = l.id and u.status <> 'free')
        order by l.area limit 1`,
    );
    layoutId = rows[0]!.id;
  });
  afterAll(() => db.close());

  const flat = async (id: string) => {
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ data: FlatCalc }>("select site_layout_calc($1) as data", [id]),
    );
    return rows[0]!.data;
  };

  it("посетителю: планировка, блок, ЖК, застройщик и курс", async () => {
    const data = (await flat(layoutId))!;
    const { rows } = await db.admin.query<{ block_id: string; complex_id: string }>(
      `select l.block_id, b.complex_id from layouts l join blocks b on b.id = l.block_id
        where l.id = $1`,
      [layoutId],
    );
    expect(data.layout.id).toBe(layoutId);
    expect(data.block.id).toBe(rows[0]!.block_id);
    expect(data.complex.id).toBe(rows[0]!.complex_id);
    expect(data.developer.name).toBeTruthy();
    expect(data.rate).not.toBeNull();
  });

  it("квартиры — только свободные этой планировки, цена как у сайта, по этажу", async () => {
    const data = (await flat(layoutId))!;
    const { rows } = await db.admin.query<{ id: string; price: string }>(
      `select u.id, coalesce(u.price, u.price_per_m2 * l.area) as price
         from units u join layouts l on l.id = u.layout_id
        where u.layout_id = $1 and u.status = 'free'
        order by u.floor, u.number`,
      [layoutId],
    );
    expect(data.units.map((unit) => unit.id)).toEqual(rows.map((row) => row.id));
    expect(data.units.map((unit) => Number(unit.price))).toEqual(rows.map((r) => Number(r.price)));
  });

  it("программы — включённые и действующие на блок планировки, без полей скидки", async () => {
    const data = (await flat(layoutId))!;
    const { rows } = await db.admin.query<{ id: string }>(
      `select p.id from payment_programs p join blocks b on b.id = $1
        where p.developer_id = (select c.developer_id from complexes c where c.id = b.complex_id)
          and p.is_active and (p.blocks_scope = 'all' or b.id = any (p.block_ids))
        order by p.sort, p.created_at`,
      [data.block.id],
    );
    expect(data.programs.map((program) => program.id)).toEqual(rows.map((row) => row.id));
    expect(JSON.stringify(data)).not.toMatch(/discount/i);
  });

  it("скрытый ЖК и чужой id — null", async () => {
    expect(await flat("00000000-0000-4000-8000-000000000000")).toBeNull();
    const data = (await flat(layoutId))!;
    await db.admin.query("update complexes set status = 'hidden' where id = $1", [
      data.complex.id,
    ]);
    expect(await flat(layoutId)).toBeNull();
  });
});
