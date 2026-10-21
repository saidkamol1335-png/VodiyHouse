import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { riserChanges, type Riser } from "@/lib/units";
import { seedContent, type ContentIds } from "./content-fixtures";
import { createStaff, createTestDb, expectHint, user, type TestDb } from "./harness";
import {
  SMALL_PLAN,
  callAs,
  expectAvailabilityMatches,
  generate,
  lastAuditId,
  newBlock,
  newLayout,
  readyPublishedComplex,
  unitByNumber,
  unitEntries,
  unitsOf,
  type UnitRow,
} from "./units-fixtures";

// Шаг 12.1: массовые цена (Н3) и отделка, стояки готового блока (Н5), удаление списка (Н4),
// «нет в наличии» (Н7) — одна запись журнала на действие.
describe("квартиры: цена, отделка, стояки, удаление списка", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let block: string;
  let oneRoom: string;
  let twoRoom: string;

  const ids_ = (units: UnitRow[]) => units.map((unit) => unit.id);

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    block = await newBlock(db.admin, ids.draftComplex, "С", 5);
    oneRoom = await newLayout(db.admin, block, 1, 42.5);
    twoRoom = await newLayout(db.admin, block, 2, 58.7);
    await generate(db, head, block, SMALL_PLAN, [oneRoom, twoRoom]);
  });
  afterAll(() => db.close());

  describe("цена (Н3) и отделка", () => {
    it("за м², целиком, без цены — одна из двух колонок; брони и проданные тоже", async () => {
      const units = (await unitsOf(db.admin, block)).slice(0, 4);
      await callAs(db, head, "set_units_status($1, $2, 'sold')", [block, [units[3]!.id]]);
      const since = await lastAuditId(db.admin);

      expect(
        await callAs(db, head, "set_units_price($1, $2, 'per_m2', 620)", [block, ids_(units)]),
      ).toMatchObject({ changed: 4, without_layout: 0 });
      for (const unit of await unitsOf(db.admin, block)) {
        if (units.some((u) => u.id === unit.id))
          expect(unit).toMatchObject({ price: null, price_per_m2: "620.00" });
      }
      const entry = (await unitEntries(db.admin, block)).filter((e) => e.id > since)[0];
      expect(entry?.changes).toMatchObject({
        price_per_m2: [null, 620],
        summary: { kind: "price", mode: "per_m2", count: 4 },
      });
      expect(entry?.changes).not.toHaveProperty("price");

      // Сайт: свободной — площадь × цена м² без округления, проданной — без цены.
      const site = await db.as(user(manager), (tx) =>
        tx.query<{ number: string; price: string | null }>(
          "select number, price::text from block_units($1)",
          [block],
        ),
      );
      const byNumber = new Map(site.rows.map((row) => [row.number, row.price]));
      const free = units.find((unit) => unit.status === "free" && unit.layout_id === oneRoom)!;
      expect(Number(byNumber.get(free.number))).toBe(42.5 * 620);
      expect(byNumber.get(units[3]!.number)).toBeNull();

      await callAs(db, head, "set_units_price($1, $2, 'total', 37200)", [block, [units[0]!.id]]);
      expect(await unitByNumber(db.admin, block, units[0]!.number)).toMatchObject({
        price: "37200.00",
        price_per_m2: null,
      });
      await callAs(db, head, "set_units_price($1, $2, 'none')", [block, [units[0]!.id]]);
      expect(await unitByNumber(db.admin, block, units[0]!.number)).toMatchObject({
        price: null,
        price_per_m2: null,
      });
    });

    it("цена 0, минус, без суммы, дробь мельче копейки, слишком большая — отказ", async () => {
      const unit = await unitByNumber(db.admin, block, "9");
      for (const [mode, value] of [
        ["total", 0],
        ["per_m2", -1],
        ["total", null],
        ["total", 0.004],
        ["total", 41000.004],
        ["total", 1e12],
        ["per_m2", 1e9],
        ["none", 5],
        ["rub", 5],
      ]) {
        await expectHint(
          callAs(db, head, "set_units_price($1, $2, $3, $4)", [block, [unit.id], mode, value]),
          "vh:invalid",
          "price",
        );
      }
      expect(await unitByNumber(db.admin, block, "9")).toMatchObject({
        price: null,
        price_per_m2: null,
      });
      await callAs(db, head, "set_units_price($1, $2, 'per_m2', 999999999.99)", [block, [unit.id]]);
    });

    it("квартира без планировки: цена за м² ставится, ответ предупреждает", async () => {
      const unit = await unitByNumber(db.admin, block, "10");
      await callAs(db, head, "update_unit($1, $2, '{\"layout_id\": null}'::jsonb)", [
        block,
        unit.id,
      ]);
      expect(
        await callAs(db, head, "set_units_price($1, $2, 'per_m2', 700)", [block, [unit.id]]),
      ).toMatchObject({ without_layout: 1 });
    });

    it("отделка: действующая — да, скрытая — нет; пусто — «как в блоке»; одна запись", async () => {
      const units = (await unitsOf(db.admin, block)).slice(4, 7);
      const { rows } = await db.admin.query<{ id: number }>(
        "select id from finishings where slug = 'white-box'",
      );
      const whiteBox = rows[0]!.id;
      const since = await lastAuditId(db.admin);
      expect(
        await callAs(db, head, "set_units_finishing($1, $2, $3::smallint)", [
          block,
          ids_(units),
          whiteBox,
        ]),
      ).toMatchObject({ changed: 3 });
      expect((await unitEntries(db.admin, block)).filter((e) => e.id > since)).toEqual([
        expect.objectContaining({
          changes: expect.objectContaining({ finishing_id: [null, whiteBox] }),
        }),
      ]);
      await db.admin.query("update finishings set is_active = false where slug = 'rough'");
      await expectHint(
        callAs(
          db,
          head,
          "set_units_finishing($1, $2, (select id from finishings where slug = 'rough'))",
          [block, ids_(units)],
        ),
        "vh:invalid",
      );
      await callAs(db, head, "set_units_finishing($1, $2, null)", [block, ids_(units)]);
      expect(
        (await unitsOf(db.admin, block)).slice(4, 7).every((unit) => unit.finishing_id === null),
      ).toBe(true);
    });
  });

  describe("стояки готового блока (Н5)", () => {
    it("пары riserChanges меняют только попавшие квартиры; одна запись с подписями", async () => {
      const units = await unitsOf(db.admin, block);
      // Верхний этаж позиции 2 обоих подъездов (№ 8 и 16) — 1-комн.; квартиры вне стояка не трогаются.
      const risers: Riser[] = [
        { entrance: null, position: 2, floorFrom: 5, floorTo: 5, layoutId: oneRoom },
      ];
      const pairs = riserChanges(
        units.map((unit) => ({ ...unit, layoutId: unit.layout_id })),
        risers,
      );
      expect(pairs).toHaveLength(2);
      const since = await lastAuditId(db.admin);
      expect(
        await callAs(db, head, "set_units_layouts($1, $2::jsonb)", [
          block,
          JSON.stringify(pairs.map((p) => ({ id: p.id, layout_id: p.layoutId }))),
        ]),
      ).toMatchObject({ changed: 2 });
      const entry = (await unitEntries(db.admin, block)).filter((e) => e.id > since);
      expect(entry).toHaveLength(1);
      expect(entry[0]?.changes).toMatchObject({
        layout: ["2-комн. · 58,7 м²", "1-комн. · 42,5 м²"],
        summary: {
          kind: "layouts",
          count: 2,
          numbers: "8, 16",
          assigned: [{ layout_id: oneRoom, label: "1-комн. · 42,5 м²", count: 2 }],
        },
      });
      await expectAvailabilityMatches(db, head, ids.draftComplex);
    });

    it("снять планировку можно; без ключа, дважды, чужая планировка или квартира — отказ", async () => {
      const unit = await unitByNumber(db.admin, block, "11");
      const other = await unitByNumber(db.admin, block, "12");
      const setLayouts = (items: object[]) =>
        callAs(db, head, "set_units_layouts($1, $2::jsonb)", [block, JSON.stringify(items)]);
      await setLayouts([{ id: unit.id, layout_id: null }]);
      expect((await unitByNumber(db.admin, block, "11")).layout_id).toBeNull();
      // Нет ключа — не «снять молча»: ответ riserChanges (layoutId) прямо сюда не годится.
      await expectHint(setLayouts([{ id: other.id, layoutId: oneRoom }]), "vh:invalid");
      await expectHint(
        setLayouts([
          { id: other.id, layout_id: oneRoom },
          { id: other.id, layout_id: twoRoom },
        ]),
        "vh:invalid",
      );
      expect((await unitByNumber(db.admin, block, "12")).layout_id).toBe(other.layout_id);
      await expectHint(
        setLayouts([{ id: unit.id, layout_id: ids.oneRoomLayout }]),
        "vh:invalid",
        "layout_id",
      );
      await expectHint(setLayouts([{ id: ids.units[0], layout_id: oneRoom }]), "vh:not_found");

      // Разные цели — без пары «было → стало», подробности только в summary.assigned.
      const since = await lastAuditId(db.admin);
      await setLayouts([
        { id: unit.id, layout_id: oneRoom },
        { id: other.id, layout_id: null },
      ]);
      const entry = (await unitEntries(db.admin, block)).filter((e) => e.id > since);
      expect(entry).toHaveLength(1);
      expect(entry[0]?.changes).not.toHaveProperty("layout");
      expect(entry[0]?.changes.summary).toMatchObject({ kind: "layouts", count: 2 });
    });

    it("опубликованный ЖК: снять планировку со всех квартир с «ценой от» нельзя", async () => {
      const ready = await readyPublishedComplex(db.admin, ids.publicDeveloper, "ready-risers");
      await generate(db, head, ready.blockId, { ...SMALL_PLAN, unitsPerFloor: [1, 1] }, [
        ready.layoutId,
      ]);
      const items = (await unitsOf(db.admin, ready.blockId)).map((unit) => ({
        id: unit.id,
        layout_id: null,
      }));
      await expectHint(
        callAs(db, head, "set_units_layouts($1, $2::jsonb)", [
          ready.blockId,
          JSON.stringify(items),
        ]),
        "vh:not_ready",
      );
    });
  });

  describe("удаление списка блока (Н4)", () => {
    it("с названием блока; наличие и «цена от» планировок переходят в ручной режим", async () => {
      const target = await newBlock(db.admin, ids.draftComplex, "У", 5);
      // Ручная «цена от» студии устарела (35 000): сайт показывал цену свободной квартиры.
      const studio = await newLayout(db.admin, target, 0, 30, 35000);
      const soldOut = await newLayout(db.admin, target, 3, 80, 90000);
      await generate(db, head, target, SMALL_PLAN, [studio, soldOut]);
      const units = await unitsOf(db.admin, target);
      const soldOutIds = units.filter((unit) => unit.layout_id === soldOut).map((unit) => unit.id);
      await callAs(db, manager, "set_units_status($1, $2, 'sold')", [target, soldOutIds]);
      await callAs(db, head, "set_units_price($1, $2, 'total', 25000)", [target, [units[0]!.id]]);

      await expectHint(
        callAs(db, head, "delete_block_units($1, 'X')", [target]),
        "vh:confirm_name",
      );
      expect(await unitsOf(db.admin, target)).toHaveLength(16);

      const since = await lastAuditId(db.admin);
      expect(await callAs(db, head, "delete_block_units($1, ' У ')", [target])).toMatchObject({
        deleted: 16,
      });
      expect((await unitEntries(db.admin, target)).filter((e) => e.id > since)).toHaveLength(1);
      const layouts = await db.admin.query<{
        id: string;
        available: boolean;
        price_from: string | null;
      }>("select id, available, price_from from layouts where block_id = $1", [target]);
      expect(new Map(layouts.rows.map((row) => [row.id, row]))).toEqual(
        new Map([
          [studio, { id: studio, available: true, price_from: "25000.00" }],
          [soldOut, { id: soldOut, available: false, price_from: "90000.00" }],
        ]),
      );
      const journal = await unitEntries(db.admin, target);
      expect(journal.at(-1)).toMatchObject({
        action: "delete",
        changes: {
          summary: {
            kind: "delete_list",
            count: 16,
            numbers: "1–16",
            statuses: { free: 8, reserved: 0, sold: 8 },
          },
        },
      });

      // Список снова создаётся генератором, а блок без списка удаляется вкладкой «Блоки».
      await generate(db, head, target, SMALL_PLAN, [studio, soldOut]);
      await callAs(db, head, "delete_block_units($1, 'У')", [target]);
      await expectHint(callAs(db, head, "delete_block_units($1, 'У')", [target]), "vh:not_found");
    });
  });

  describe("«нет в наличии» у блока без списка (Н7)", () => {
    it("менеджер меняет флаг функцией: журнал с автором, сайт видит; прямой правки нет", async () => {
      const manual = await newBlock(db.admin, ids.draftComplex, "M", 9);
      const layout = await newLayout(db.admin, manual, 4, 120, 150000);
      expect(await callAs(db, manager, "set_layout_available($1, false)", [layout])).toMatchObject({
        changed: 1,
      });
      const site = await db.as(user(manager), (tx) =>
        tx.query<{ available: boolean }>(
          "select available from layout_availability($1) where layout_id = $2",
          [ids.draftComplex, layout],
        ),
      );
      expect(site.rows[0]?.available).toBe(false);
      const subject = await callAs<string>(
        db,
        head,
        "(select j.subject from journal_entries(null, null, 1, $1) j)",
        [ids.draftComplex],
      );
      expect(subject).toBe("Блок M · 4-комн. · 120 м²");

      const direct = await db.as(user(manager), (tx) =>
        tx.query("update layouts set available = true where id = $1", [layout]),
      );
      expect(direct.affectedRows ?? 0).toBe(0);
      await expectHint(
        callAs(db, manager, "set_layout_available($1, true)", [oneRoom]),
        "vh:list_exists",
      );
      await expectHint(
        callAs(db, manager, "set_layout_available($1, null)", [layout]),
        "vh:invalid",
      );

      // «Планировки» без ключа available флаг не трогают (устаревший черновик не затрёт «нет в наличии»).
      await callAs(db, head, "save_block_layouts($1, $2::jsonb)", [
        manual,
        JSON.stringify([{ id: layout, rooms: 4, area: 120, price_from: 150000 }]),
      ]);
      expect(
        (
          await db.admin.query<{ available: boolean }>(
            "select available from layouts where id = $1",
            [layout],
          )
        ).rows[0]?.available,
      ).toBe(false);
      await callAs(db, head, "save_block_layouts($1, $2::jsonb)", [
        manual,
        JSON.stringify([{ id: layout, rooms: 4, area: 120, price_from: 150000, available: true }]),
      ]);
      expect(
        (
          await db.admin.query<{ available: boolean }>(
            "select available from layouts where id = $1",
            [layout],
          )
        ).rows[0]?.available,
      ).toBe(true);
    });
  });
});
