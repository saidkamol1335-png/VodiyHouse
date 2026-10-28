import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 3.15: страницы застройщиков — site_developers() и site_developer(slug) на DEMO-сиде
// (миграция 20261028120000_site_developers.sql): только опубликованные, без внутренних контактов;
// архив — «archived» для редиректа на список.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Summary = { id: string; slug: string; name: string; founded_year: number | null; logo: unknown };
type Page = Summary & {
  about: { ru: string; uz: string } | null;
  flats_delivered: number | null;
  past_projects: { name: { ru: string }; planned_on: string | null; delivered_on: string | null }[];
};

describe.skipIf(isRemoteTarget)("застройщики на сайте: site_developers() и site_developer()", () => {
  let db: TestDb;
  const list = async () =>
    (await db.as(anon, (tx) => tx.query<{ data: Summary[] }>("select site_developers() as data"))).rows[0]!.data;
  const page = async (slug: string) =>
    (await db.as(anon, (tx) => tx.query<{ data: Page | null }>("select site_developer($1) as data", [slug]))).rows[0]!.data;
  const state = async (slug: string) =>
    (await db.as(anon, (tx) => tx.query<{ data: string | null }>("select site_developer_slug_state($1) as data", [slug]))).rows[0]!.data;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("список — опубликованные по порядку руководителя, с годом; логотипа у DEMO нет", async () => {
    const rows = await list();
    expect(rows.map((row) => row.slug)).toEqual(["demo-sifat", "demo-margilan-invest", "demo-kamalak"]);
    expect(rows[0]).toMatchObject({ name: "Farg‘ona Sifat Qurilish", founded_year: 2012, logo: null });
  });

  it("страница Sifat: о компании, «Сдано квартир», сданные объекты план / факт по порядку", async () => {
    const data = (await page("demo-sifat"))!;
    expect(data.about?.ru).toMatch(/Фергане/);
    expect(data.flats_delivered).toBe(2140);
    expect(data.past_projects.map((project) => project.name.ru)).toEqual(["Дом на ул. Мустакиллик, 14", "ЖК Sifat City"]);
    expect(data.past_projects[1]).toMatchObject({ planned_on: "2022-12-31", delivered_on: "2023-03-31" });
  });

  it("внутренних контактов и заметок посетителю нет (правило 1.2)", async () => {
    const text = JSON.stringify(await page("demo-sifat"));
    for (const hidden of ["developer_private", "contacts", "notes", "files_checked_at", "updated_by"]) {
      expect(text).not.toContain(hidden);
    }
  });

  it("черновик и архив посетителю — null; архив отвечает «archived» для редиректа, чужой адрес — ничем", async () => {
    await db.admin.query("update developers set status = 'draft' where slug = 'demo-kamalak'");
    expect(await page("demo-kamalak")).toBeNull();
    expect((await list()).map((row) => row.slug)).not.toContain("demo-kamalak");
    await db.admin.query("update developers set status = 'archived', archived_at = now() where slug = 'demo-kamalak'");
    expect(await page("demo-kamalak")).toBeNull();
    expect(await state("demo-kamalak")).toBe("archived");
    expect(await state("demo-sifat")).toBeNull();
    expect(await state("net-takogo")).toBeNull();
    // Обратно не публикуем: публикация требует логотип, которого у DEMO нет; база одноразовая.
  });
});
