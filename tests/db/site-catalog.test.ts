import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { blockPaymentFrom } from "@/lib/site/catalog/payment";
import { catalogFrom, type SiteCatalogRecord } from "@/lib/site/catalog/records";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 3.3: каталог сайта — site_catalog() ролью посетителя на DEMO-сиде. Опубликованные ЖК
// опубликованных застройщиков, наличие по комнатам — как «Остатки по ЖК» мокапа, программы — без
// полей скидки (PLAN §3.13), никаких полей сотрудников.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Offer = { rooms: number; available: boolean; free: number | null; price_from: number | null; price_to: number | null };
type Block = { name: string; currency: string; floors_total: number; finishing: { slug: string }; offers: Offer[] };
type Complex = { slug: string; developer_id: string; blocks: Block[]; photos: unknown[]; checked: Record<string, string | null> };
type Catalog = {
  rate: unknown;
  developers: { id: string; slug: string; programs: { type: string }[] }[];
  complexes: Complex[];
};

describe.skipIf(isRemoteTarget)("каталог сайта: site_catalog()", () => {
  let db: TestDb;
  const catalog = async () =>
    (await db.as(anon, (tx) => tx.query<{ data: Catalog }>("select site_catalog() as data"))).rows[0]!.data;
  const complex = (data: Catalog, slug: string) => data.complexes.find((c) => c.slug === slug)!;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("четыре опубликованных ЖК DEMO в порядке руководителя, у каждого застройщик из списка", async () => {
    const data = await catalog();
    expect(data.complexes.map((c) => c.slug)).toEqual(["demo-shodlik", "demo-namuna", "demo-yulduz", "demo-orzu"]);
    const developers = new Set(data.developers.map((d) => d.id));
    expect(data.complexes.every((c) => developers.has(c.developer_id))).toBe(true);
    expect(data.rate).not.toBeNull();
  });

  it("свободно по комнатам блока — как «Остатки по ЖК» мокапа (Shodlik: A — 4 / 6 / 2)", async () => {
    const [blockA, blockB] = complex(await catalog(), "demo-shodlik").blocks;
    expect(blockA!.name).toBe("A");
    expect(blockA!.offers.map((o) => [o.rooms, o.free])).toEqual([[1, 4], [2, 6], [3, 2]]);
    expect(blockB!.offers.map((o) => o.free)).toEqual([10, 16, 3]);
    expect(blockA!.offers.every((o) => o.available && (o.price_from ?? 0) > 0)).toBe(true);
    expect(blockA!.offers.every((o) => (o.price_to ?? 0) >= (o.price_from ?? 0))).toBe(true);
    // Цена растёт с этажом (формула сида): у типа с несколькими свободными «до» дороже «от».
    expect(blockA!.offers.some((o) => (o.price_to ?? 0) > (o.price_from ?? 0))).toBe(true);
    expect(blockA).toMatchObject({ currency: "USD", floors_total: 12, finishing: { slug: "rough" } });
  });

  it("ответ проходит преобразователь сайта: числа — числами, программы — программами lib/calc", async () => {
    const data = catalogFrom((await catalog()) as unknown as SiteCatalogRecord);
    const shodlik = data.complexes.find((c) => c.slug === "demo-shodlik")!;
    expect(typeof shodlik.blocks[0]!.offers[0]!.priceFrom).toBe("number");
    expect(shodlik.blocks[0]!.deadline).toEqual({ year: 2025, quarter: 3 });
    expect(data.developers.flatMap((d) => d.programs).length).toBeGreaterThan(0);
    expect(data.rate?.usdUzs).toBeGreaterThan(0);
  });

  it("«Платёж от» блока — по его программам; без рассрочек застройщика — не из чего считать", async () => {
    const data = catalogFrom((await catalog()) as unknown as SiteCatalogRecord);
    const orzu = data.complexes.find((c) => c.slug === "demo-orzu")!;
    const shodlikA = data.complexes.find((c) => c.slug === "demo-shodlik")!.blocks[0]!;
    const shodlikPrice = Math.min(...shodlikA.offers.map((o) => o.priceFrom ?? Infinity));
    const payment = blockPaymentFrom(data, data.complexes[0]!.developerId, shodlikA);
    expect(payment).toBeGreaterThan(0);
    expect(payment).toBeLessThan(shodlikPrice);
    // Orzu 1: схема Kamalak — только на Orzu 2, но рассрочка через банк — на все блоки.
    expect(blockPaymentFrom(data, orzu.developerId, orzu.blocks.find((b) => b.name === "1")!)).toBeGreaterThan(0);
    const withoutPrograms = { ...data, developers: data.developers.map((d) => ({ ...d, programs: [] })) };
    expect(blockPaymentFrom(withoutPrograms, orzu.developerId, orzu.blocks[0]!)).toBeNull();
  });

  it("без полей скидки и сотрудников", async () => {
    const text = JSON.stringify(await catalog());
    for (const hidden of ["discount_pct", "developer_private", "notes", "contacts", "created_by"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("служебные функции каталога посетителю недоступны", async () => {
    await expect(
      db.as(anon, (tx) => tx.query("select private.catalog_blocks(gen_random_uuid())")),
    ).rejects.toThrow(/permission denied/);
  });

  // Последним: вернуть «опубликован» без фото DEMO не даёт проверка публикации.
  it("снятый с сайта ЖК и неопубликованный застройщик в каталог не попадают", async () => {
    await db.admin.query("update complexes set status = 'hidden' where slug = 'demo-orzu'");
    await db.admin.query("update developers set status = 'hidden' where slug = 'demo-margilan-invest'");
    const data = await catalog();
    expect(data.complexes.map((c) => c.slug)).toEqual(["demo-shodlik"]);
    expect(data.developers.map((d) => d.slug)).toEqual(["demo-sifat"]);
  });
});
