import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  isRemoteTarget,
  user,
  type TestDb,
} from "./harness";

// Шаг 2.5: «Расчёт для клиента» — client_calc_screen() на DEMO-сиде: застройщики с включёнными
// программами, выбранный по адресу, его программы, ЖК с планировками и свободные квартиры с ценой.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Screen = {
  developers: { id: string; slug: string; name: string }[];
  current: {
    id: string;
    slug: string;
    checked_at: string;
    price_hint: { per_m2: number; currency: string } | null;
    programs: { id: string; is_active: boolean; type: string; bank: unknown }[];
    complexes: {
      id: string;
      blocks: {
        id: string;
        currency: string;
        layouts: { id: string; price_from: number | null; available: boolean }[];
      }[];
    }[];
    units: { id: string; number: string; price: number | null; area: number | null }[];
  } | null;
};

describe.skipIf(isRemoteTarget)("«Расчёт для клиента»: данные экрана", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  const screen = async (slug: string | null = null, actor = user(manager)) => {
    const { rows } = await db.as(actor, (tx) =>
      tx.query<{ data: Screen }>("select client_calc_screen($1) as data", [slug]),
    );
    return rows[0]!.data;
  };

  it("права: руководитель и менеджер; видеографу — отказ, посетителю — нет функции", async () => {
    expect((await screen(null, user(head))).current).not.toBeNull();
    await expectHint(screen(null, user(videographer)), "vh:forbidden");
    await expectDenied(screen(null, anon));
  });

  it("застройщики с включёнными программами; выбранный — по адресу, чужой адрес — первый", async () => {
    const all = await screen();
    expect(all.developers.map((developer) => developer.slug)).toEqual([
      "demo-sifat",
      "demo-margilan-invest",
      "demo-kamalak",
    ]);
    expect(all.current!.slug).toBe("demo-sifat");
    expect((await screen("demo-margilan-invest")).current!.slug).toBe("demo-margilan-invest");
    expect((await screen("net-takogo")).current!.slug).toBe("demo-sifat");
  });

  it("программы — только включённые и действующие («выбранные» без блоков не действуют)", async () => {
    const before = (await screen("demo-kamalak")).current!.programs;
    expect(before.every((program) => program.is_active)).toBe(true);
    const [first, second] = before;
    await db.admin.query("update payment_programs set is_active = false where id = $1", [
      first!.id,
    ]);
    await db.admin.query(
      "update payment_programs set blocks_scope = 'selected', block_ids = '{}' where id = $1",
      [second!.id],
    );
    const after = (await screen("demo-kamalak")).current!.programs.map((program) => program.id);
    expect(after).toEqual(before.slice(2).map((program) => program.id));
    await db.admin.query(
      "update payment_programs set is_active = true, blocks_scope = 'all' where id = any($1)",
      [[first!.id, second!.id]],
    );
  });

  it("свободные квартиры — с ценой целиком (цена или цена м² × площадь), без проданных", async () => {
    const current = (await screen()).current!;
    const { rows } = await db.admin.query<{ id: string; price: string | null }>(
      `select u.id, coalesce(u.price, u.price_per_m2 * l.area)::text as price
         from units u
         join blocks b on b.id = u.block_id
         join complexes c on c.id = b.complex_id
         left join layouts l on l.id = u.layout_id
        where c.developer_id = $1 and c.status <> 'archived' and u.status = 'free'`,
      [current.id],
    );
    expect(current.units.length).toBe(rows.length);
    expect(current.units.length).toBeGreaterThan(0);
    const priceOf = new Map(
      rows.map((row) => [row.id, row.price === null ? null : Number(row.price)]),
    );
    for (const unit of current.units) expect(unit.price).toBe(priceOf.get(unit.id));
  });

  it("планировки — «цена от» как у сайта; цена м² по умолчанию — как у карточек программ", async () => {
    const current = (await screen()).current!;
    const complexId = current.complexes[0]!.id;
    const { rows } = await db.admin.query<{ layout_id: string; price_from: string | null }>(
      "select layout_id, price_from::text from layout_availability($1)",
      [complexId],
    );
    const site = new Map(rows.map((row) => [row.layout_id, row.price_from]));
    const layouts = current.complexes[0]!.blocks.flatMap((block) => block.layouts);
    expect(layouts.length).toBe(rows.length);
    for (const layout of layouts) {
      const expected = site.get(layout.id);
      expect(layout.price_from).toBe(expected === null ? null : Number(expected));
    }
    const { rows: panels } = await db.as(user(manager), (tx) =>
      tx.query<{ data: { slug: string; price_hint: unknown }[] }>(
        "select payment_program_panels() as data",
      ),
    );
    const panel = panels[0]!.data.find((item) => item.slug === current.slug)!;
    expect(current.price_hint).toEqual(panel.price_hint);
  });

  it("«Условия актуальны на» — позднее из правки программ и отметки «проверены»", async () => {
    const before = (await screen()).current!;
    await db.admin.query(
      "update developers set programs_checked_at = '2027-01-15T09:00:00Z' where id = $1",
      [before.id],
    );
    expect(Date.parse((await screen()).current!.checked_at)).toBe(
      Date.parse("2027-01-15T09:00:00Z"),
    );
  });
});
