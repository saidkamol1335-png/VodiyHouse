import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 2.6: /kalkulyator — site_calc_screen() на DEMO-сиде: посетитель видит опубликованных
// застройщиков с программами, программы без полей скидки (PLAN §3.13), только опубликованные ЖК.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Screen = {
  rate: { usd_uzs: number; source: string } | null;
  developers: { id: string; slug: string }[];
  current: {
    id: string;
    slug: string;
    price_hint: { per_m2: number; currency: string } | null;
    programs: { id: string; block_ids: string[] }[];
    complexes: { id: string; blocks: { id: string; layouts: { id: string }[] }[] }[];
  } | null;
};

describe.skipIf(isRemoteTarget)("/kalkulyator: данные калькулятора сайта", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  const screen = async (slug: string | null = null) => {
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ data: Screen }>("select site_calc_screen($1) as data", [slug]),
    );
    return rows[0]!.data;
  };

  it("посетителю: курс, опубликованные застройщики с программами; выбранный — по адресу", async () => {
    const all = await screen();
    expect(all.rate).toMatchObject({ source: "cbu" });
    const { rows } = await db.admin.query<{ slug: string }>(
      `select d.slug from developers d
        where d.status = 'published'
          and exists (select 1 from payment_programs p where p.developer_id = d.id and p.is_active)
        order by d.sort, d.name`,
    );
    expect(all.developers.map((developer) => developer.slug)).toEqual(rows.map((row) => row.slug));
    expect(all.current!.slug).toBe(rows[0]!.slug);
    const second = rows[1]!.slug;
    expect((await screen(second)).current!.slug).toBe(second);
  });

  it("ни одного поля и значения скидки — ни у «100% оплаты», ни у ступеней схемы", async () => {
    for (const developer of (await screen()).developers) {
      const text = JSON.stringify(await screen(developer.slug));
      expect(text).not.toMatch(/discount/i);
    }
  });

  it("только опубликованные ЖК: скрытый пропадает вместе с планировками и ценой м²", async () => {
    const before = (await screen()).current!;
    const complexId = before.complexes[0]!.id;
    await db.admin.query("update complexes set status = 'hidden' where id = $1", [complexId]);
    const after = (await screen()).current;
    expect(after?.complexes.map((complex) => complex.id) ?? []).not.toContain(complexId);
    const hidden = new Set(before.complexes[0]!.blocks.map((block) => block.id));
    for (const program of after?.programs ?? []) {
      expect(program.block_ids.filter((id) => hidden.has(id))).toEqual([]);
    }
  });

  it("посетитель не читает кабинетный экран расчёта", async () => {
    await expect(
      db.as(anon, (tx) => tx.query("select client_calc_screen(null)")),
    ).rejects.toThrow();
  });
});
