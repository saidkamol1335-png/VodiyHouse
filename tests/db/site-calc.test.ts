import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { demoSiteCalc } from "@/lib/admin/calc/siteDemo";
import { siteCalcFrom, type SiteCalcRecord, type SiteCalcScreen } from "@/lib/calc/siteScreen";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 2.6: /kalkulyator — site_calc_screen() на DEMO-сиде: посетитель видит опубликованных
// застройщиков с программами, программы без полей скидки (PLAN §3.13), только опубликованные ЖК.
// Ответ проходит тот же преобразователь, что у страницы, и совпадает с DEMO стенда.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Screen = SiteCalcRecord & {
  current:
    (NonNullable<SiteCalcRecord["current"]> & { programs: { blocks_scope: string }[] }) | null;
};

/** По смыслу, без id и дат: застройщики, программы, блоки по именам и цена м² по умолчанию. */
function comparable(screen: SiteCalcScreen) {
  const current = screen.current!;
  const { stock, options } = current.data;
  const blockName = new Map(stock.blocks.map((b) => [b.id, `${b.complexName.ru} ${b.name}`]));
  return {
    developers: screen.developers.map((developer) => developer.slug),
    current: current.slug,
    name: current.name,
    blocks: stock.blocks.map((block) => blockName.get(block.id)),
    priceHint: stock.priceHint,
    options: options.map((option) => ({
      kind: option.kind,
      bank: option.bankName?.ru ?? null,
      scope: option.blocksScope,
      blocks: option.blockIds.map((id) => blockName.get(id)),
      program: option.program,
    })),
  };
}

async function seededDb() {
  const db = await createTestDb();
  await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  return db;
}

const screenOf = async (db: TestDb, slug: string | null = null) => {
  const { rows } = await db.as(anon, (tx) =>
    tx.query<{ data: Screen }>("select site_calc_screen($1) as data", [slug]),
  );
  return rows[0]!.data;
};

describe.skipIf(isRemoteTarget)("/kalkulyator: данные калькулятора сайта", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await seededDb();
  });
  afterAll(() => db.close());

  it("посетителю: курс, опубликованные застройщики с программами; выбранный — по адресу", async () => {
    const all = await screenOf(db);
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
    expect((await screenOf(db, second)).current!.slug).toBe(second);
  });

  it("ответ проходит преобразователь страницы и совпадает с DEMO стенда /dev/kalkulyator", async () => {
    for (const { slug } of (await screenOf(db)).developers) {
      const fromDb = siteCalcFrom(await screenOf(db, slug));
      expect(comparable(fromDb), slug).toEqual(comparable(siteCalcFrom(demoSiteCalc(slug))));
    }
  });

  it("ни одного поля и значения скидки, ни текста условий — ни у одной программы", async () => {
    for (const developer of (await screenOf(db)).developers) {
      const text = JSON.stringify(await screenOf(db, developer.slug));
      expect(text).not.toMatch(/discount/i);
      expect(text).not.toMatch(/"conditions"/);
    }
  });

  it("скрытый ЖК: пропадают его блоки, цена м² и программа только для него", async () => {
    const before = (await screenOf(db)).current!;
    const only = before.programs.find((program) => program.blocks_scope === "selected")!;
    await db.admin.query("update complexes set status = 'hidden' where id = $1", [
      before.complexes[0]!.id,
    ]);
    const after = (await screenOf(db)).current!;
    expect(after.slug).toBe(before.slug);
    expect(after.complexes).toEqual([]);
    expect(after.price_hint).toBeNull();
    expect(after.programs.map((program) => program.id)).not.toContain(only.id);
  });

  it("программа на открытом и скрытом блоках — у сайта только открытый", async () => {
    const { rows } = await db.admin.query<{ id: string; open: string; closed: string }>(
      `select p.id, open.id as open, closed.id as closed
         from payment_programs p
         join developers d on d.id = p.developer_id and d.slug = 'demo-margilan-invest'
         join complexes oc on oc.developer_id = d.id and oc.slug = 'demo-namuna'
         join blocks open on open.complex_id = oc.id
         join complexes cc on cc.developer_id = d.id and cc.slug = 'demo-yulduz'
         join blocks closed on closed.complex_id = cc.id
        where p.type = 'mortgage' limit 1`,
    );
    const { id, open, closed } = rows[0]!;
    await db.admin.query(
      "update payment_programs set blocks_scope = 'selected', block_ids = $2 where id = $1",
      [id, [open, closed]],
    );
    await db.admin.query("update complexes set status = 'hidden' where slug = 'demo-yulduz'");
    const program = (await screenOf(db, "demo-margilan-invest")).current!.programs.find(
      (item) => item.id === id,
    )!;
    expect(program.block_ids).toEqual([open]);
  });

  it("посетитель не читает кабинетный экран расчёта", async () => {
    await expect(
      db.as(anon, (tx) => tx.query("select client_calc_screen(null)")),
    ).rejects.toThrow();
  });
});

describe.skipIf(isRemoteTarget)("/kalkulyator: кого не видно на сайте", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await seededDb();
  });
  afterAll(() => db.close());

  it("черновик застройщика, выключенная программа, программы только на скрытых ЖК", async () => {
    await db.admin.query("update developers set status = 'draft' where slug = 'demo-kamalak'");
    const { rows } = await db.admin.query<{ id: string }>(
      `update payment_programs set is_active = false
        where id = (select p.id from payment_programs p join developers d on d.id = p.developer_id
                     where d.slug = 'demo-margilan-invest' and p.type = 'mortgage' limit 1)
        returning id`,
    );
    await db.admin.query(
      `update payment_programs p set blocks_scope = 'selected',
              block_ids = (select array_agg(b.id) from blocks b join complexes c on c.id = b.complex_id
                            where c.developer_id = p.developer_id)
         from developers d where d.id = p.developer_id and d.slug = 'demo-sifat'`,
    );
    await db.admin.query(
      `update complexes c set status = 'hidden' from developers d
        where d.id = c.developer_id and d.slug = 'demo-sifat'`,
    );
    const all = await screenOf(db);
    const slugs = all.developers.map((developer) => developer.slug);
    expect(slugs).not.toContain("demo-kamalak");
    expect(slugs).not.toContain("demo-sifat");
    const margilan = (await screenOf(db, "demo-margilan-invest")).current!;
    expect(margilan.programs.map((program) => program.id)).not.toContain(rows[0]!.id);
    // Чужой или скрытый slug — первый из видимых, а не скрытый застройщик.
    expect((await screenOf(db, "demo-kamalak")).current!.slug).toBe(slugs[0]);
    expect((await screenOf(db, "no-such-slug")).current!.slug).toBe(slugs[0]);
  });
});
