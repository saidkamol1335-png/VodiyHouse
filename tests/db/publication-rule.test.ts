import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeComplexReady, seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectDenied, expectHint, user, type TestDb } from "./harness";

// Правило публикации v2 (docs/publication-rule.md): минимум ЖК, полнота планировки, что видит сайт.

type SiteComplex = {
  complex: { state: string };
  layouts: { id: string; available: boolean; price_from: string | number | null; free: number | null }[];
};
type UnitRow = {
  unit_id: string;
  number: string;
  status: string;
  layout_id: string | null;
  rooms: number | null;
  price: string | null;
  sellable: boolean;
};

describe("правило публикации v2", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
  });
  afterAll(() => db.close());

  const newReady = async (slug: string) => {
    const { rows } = await db.admin.query<{ id: string }>(
      `insert into complexes (developer_id, slug, name)
       values ($1, $2, jsonb_build_object('ru', $2::text, 'uz', $2::text)) returning id`,
      [ids.publicDeveloper, slug],
    );
    const id = rows[0]!.id;
    await makeComplexReady(db.admin, id);
    await db.admin.query(
      "update complexes set status = 'published', files_checked_at = clock_timestamp() where id = $1",
      [id],
    );
    const { rows: refs } = await db.admin.query<{ block_id: string; layout_id: string }>(
      `select b.id as block_id, l.id as layout_id from blocks b join layouts l on l.block_id = b.id
       where b.complex_id = $1`,
      [id],
    );
    return { id, slug, blockId: refs[0]!.block_id, layoutId: refs[0]!.layout_id };
  };
  const page = async (slug: string) =>
    (await db.as(anon, (tx) => tx.query<{ data: SiteComplex }>("select site_complex($1) as data", [slug]))).rows[0]!.data;
  const addUnit = (blockId: string, layoutId: string, number: string, status: string, price: number | null) =>
    db.admin.query(
      `insert into units (block_id, layout_id, entrance, floor, position, number, price, status)
       values ($1, $2, 1, 2, $3::smallint, $3, $4, $5)`,
      [blockId, layoutId, number, price, status],
    );
  const setDrawing = async (layoutId: string, complexId: string, width: number) => {
    const { rows } = await db.admin.query<{ id: string }>(
      `insert into media_assets (complex_id, kind, path, width, height)
       values ($1, 'drawing', $2, $3, 400) returning id`,
      [complexId, `complexes/${complexId}/${crypto.randomUUID()}.png`, width],
    );
    await db.admin.query("update layouts set drawing_id = $1 where id = $2", [rows[0]!.id, layoutId]);
  };
  const siteUnits = async (blockId: string) =>
    (await db.as(anon, (tx) => tx.query<UnitRow>("select * from block_units($1)", [blockId]))).rows;

  describe("минимум ЖК", () => {
    it("обложка 2399 px не проходит, 2400 — проходит", async () => {
      const ready = await newReady("cover-border");
      const rendersOk = async () =>
        (
          await db.as(user(head), (tx) =>
            tx.query<{ requirement: string; ok: boolean }>("select * from complex_readiness($1)", [ready.id]),
          )
        ).rows.find((row) => row.requirement === "renders")!.ok;
      expect(await rendersOk()).toBe(true);
      await db.admin.query(
        `update media_assets set width = 2399 where id = (
           select id from media_assets where complex_id = $1 and kind = 'photo'
           order by sort, created_at, id limit 1)`,
        [ready.id],
      );
      expect(await rendersOk()).toBe(false);
    });

    it("рендер квартиры не считается: у опубликованного тип последнего нужного не снять", async () => {
      const ready = await newReady("render-kinds");
      const { rows } = await db.admin.query<{ id: string }>(
        "select id from media_assets where complex_id = $1 and kind = 'photo' order by sort desc limit 1",
        [ready.id],
      );
      await expectHint(
        db.as(user(head), (tx) => tx.query("select set_complex_photo_category($1, 'apartment')", [rows[0]!.id])),
        "vh:not_ready",
      );
    });

    it("у опубликованного нельзя убрать программу, застройщика и курс", async () => {
      await newReady("guards");
      const other = await newReady("guards-other");
      // Вторая программа — только на блок другого ЖК: застройщик с программой останется, этот ЖК — нет.
      await db.admin.query(
        `insert into payment_programs (developer_id, type, discount_pct, is_active, blocks_scope, block_ids)
         values ($1, 'full', 5, true, 'selected', array[$2::uuid])`,
        [ids.publicDeveloper, other.blockId],
      );
      await expectHint(
        db.admin.query(
          "update payment_programs set is_active = false where developer_id = $1 and blocks_scope = 'all'",
          [ids.publicDeveloper],
        ),
        "vh:not_ready",
      );
      await expectHint(
        db.admin.query("update developers set status = 'hidden' where id = $1", [ids.publicDeveloper]),
        "vh:developer_has_published",
      );
      await db.admin.query(
        `update settings set value = '{"cbu": null, "manual": {"usd_uzs": 12800, "date": "2026-11-01"}}'
         where key = 'exchange.usd_uzs'`,
      );
      await expectHint(
        db.as(user(head), (tx) => tx.query("select set_manual_exchange_rate(null)")),
        "vh:rate_required",
      );
    });

    it("застройщик необязателен только у черновика", async () => {
      const { rows } = await db.admin.query<{ id: string }>(
        `insert into complexes (slug, name) values ('no-developer', '{"ru": "Без", "uz": "Yoq"}') returning id`,
      );
      await expect(
        db.admin.query("update complexes set status = 'hidden' where id = $1", [rows[0]!.id]),
      ).rejects.toThrow(/complexes_developer_required/);
      const listed = await db.as(user(head), (tx) => tx.query<{ slug: string }>("select slug from complex_rows()"));
      expect(listed.rows.map((row) => row.slug)).toContain("no-developer");
      const created = await db.as(user(head), (tx) =>
        tx.query<{ id: string }>(`select create_complex(null, '{"ru": "Новый", "uz": "Yangi"}', 'new-empty') as id`),
      );
      expect(created.rows[0]!.id).toBeTruthy();
    });
  });

  describe("автопереключение", () => {
    it("первая полная → full, исчезла последняя → soon; статус «опубликован» не меняется", async () => {
      const ready = await newReady("auto-switch");
      await db.admin.query("update layouts set drawing_id = null, price_from = null where id = $1", [ready.layoutId]);
      expect((await page(ready.slug)).complex.state).toBe("soon");
      expect((await page(ready.slug)).layouts).toEqual([]);

      await setDrawing(ready.layoutId, ready.id, 1199);
      await addUnit(ready.blockId, ready.layoutId, "1", "free", 40000);
      expect((await page(ready.slug)).complex.state).toBe("soon");

      await setDrawing(ready.layoutId, ready.id, 1200);
      const full = await page(ready.slug);
      expect(full.complex.state).toBe("full");
      expect(full.layouts.map((layout) => layout.id)).toEqual([ready.layoutId]);

      await db.admin.query("update units set price = null where block_id = $1", [ready.blockId]);
      expect((await page(ready.slug)).complex.state).toBe("soon");
      const { rows } = await db.admin.query<{ status: string }>("select status from complexes where id = $1", [ready.id]);
      expect(rows[0]!.status).toBe("published");
    });

    it("распроданная планировка остаётся: «нет в наличии» без цены, ЖК полный", async () => {
      const ready = await newReady("sold-out");
      await addUnit(ready.blockId, ready.layoutId, "1", "sold", 40000);
      const data = await page(ready.slug);
      expect(data.complex.state).toBe("full");
      expect(data.layouts[0]).toMatchObject({ id: ready.layoutId, available: false, price_from: null, free: 0 });
    });

    it("блок без списка: полная при чертеже и цене, без «доступна» — «нет в наличии»", async () => {
      const ready = await newReady("no-list");
      expect((await page(ready.slug)).layouts[0]).toMatchObject({ available: true, free: null });
      await db.admin.query("update layouts set available = false where id = $1", [ready.layoutId]);
      expect((await page(ready.slug)).layouts[0]).toMatchObject({ available: false, price_from: null });
      await db.admin.query("update layouts set price_from = null where id = $1", [ready.layoutId]);
      expect((await page(ready.slug)).complex.state).toBe("soon");
    });
  });

  describe("неполное наружу не уходит", () => {
    it("фасад: квартира неполной планировки — без планировки, комнат и цены", async () => {
      const ready = await newReady("facade-gray");
      await db.admin.query("update layouts set drawing_id = null where id = $1", [ready.layoutId]);
      await addUnit(ready.blockId, ready.layoutId, "1", "free", 40000);
      expect((await siteUnits(ready.blockId))[0]).toMatchObject({
        status: "free",
        layout_id: null,
        rooms: null,
        price: null,
        sellable: false,
      });
    });

    it("свободная квартира без цены в полной планировке серая и не входит в «осталось N»", async () => {
      const ready = await newReady("free-no-price");
      await addUnit(ready.blockId, ready.layoutId, "1", "free", 40000);
      await addUnit(ready.blockId, ready.layoutId, "2", "free", null);
      const units = await siteUnits(ready.blockId);
      expect(units.find((unit) => unit.number === "1")?.sellable).toBe(true);
      expect(units.find((unit) => unit.number === "2")?.sellable).toBe(false);
      expect((await page(ready.slug)).layouts[0]!.free).toBe(1);
    });

    it("расчёт и функции наличия неполную планировку посетителю не отдают", async () => {
      const ready = await newReady("calc-closed");
      await db.admin.query("update layouts set drawing_id = null where id = $1", [ready.layoutId]);
      const calc = await db.as(anon, (tx) =>
        tx.query<{ data: unknown }>("select site_layout_calc($1) as data", [ready.layoutId]),
      );
      expect(calc.rows[0]!.data).toBeNull();
      await expectDenied(db.as(anon, (tx) => tx.query("select * from layout_availability($1)", [ready.id])));
    });
  });

  it("кабинет: состояние и «Полных квартир: k из n»; посетителю закрыто", async () => {
    const ready = await newReady("cabinet-state");
    const states = await db.as(user(head), (tx) =>
      tx.query<{ complex_id: string; state: string; total: number; complete_layouts: number; layouts: number }>(
        "select * from complex_states()",
      ),
    );
    expect(states.rows.find((row) => row.complex_id === ready.id)).toMatchObject({
      state: "full",
      total: 6,
      complete_layouts: 1,
      layouts: 1,
    });
    const detail = await db.as(user(head), (tx) =>
      tx.query<{ data: { state: string } }>("select complex_completeness($1) as data", [ids.draftComplex]),
    );
    expect(detail.rows[0]!.data.state).toBe("draft");
    await expectDenied(db.as(anon, (tx) => tx.query("select * from complex_states()")));
    await expectDenied(db.as(anon, (tx) => tx.query("select complex_completeness($1)", [ready.id])));
  });
});
