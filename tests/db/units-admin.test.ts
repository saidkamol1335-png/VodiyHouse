import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BLOCK_PLAN_LIMITS, type BlockPlan } from "@/lib/units";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createAuthUser,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  type TestDb,
} from "./harness";
import {
  SMALL_PLAN,
  callAs,
  expectAvailabilityMatches,
  generate,
  newBlock,
  newLayout,
  planRows,
  readyPublishedComplex,
  unitByNumber,
  unitEntries,
  unitsOf,
} from "./units-fixtures";

// Шаг 12.1: права функций квартир, генератор, «+ Квартира», правка строки, удаление (Н4, Н6).
const WRITE_FUNCTIONS: Record<string, string> = {
  create_block_units: "create_block_units($1, '[]'::jsonb)",
  add_unit: "add_unit($1, 1, 2, 1, '999')",
  update_unit: "update_unit($1, gen_random_uuid(), '{}'::jsonb)",
  delete_units: "delete_units($1, array[gen_random_uuid()])",
  delete_block_units: "delete_block_units($1, 'A')",
  set_units_price: "set_units_price($1, array[gen_random_uuid()], 'total', 1)",
  set_units_finishing: "set_units_finishing($1, array[gen_random_uuid()], null)",
  set_units_layouts: "set_units_layouts($1, '[]'::jsonb)",
  set_units_status: "set_units_status($1, array[gen_random_uuid()], 'sold')",
  revert_units_status: "revert_units_status($1, 'sold', '[]'::jsonb)",
  set_layout_available: "set_layout_available($1, false)",
};
const MANAGER_FUNCTIONS = new Set([
  "set_units_status",
  "revert_units_status",
  "set_layout_available",
]);

describe("квартиры в кабинете: права, генератор, правка списка", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let videographer: string;
  let inactiveManager: string;
  let noProfile: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager", { fullName: "Дилноза Юсупова" });
    videographer = await createStaff(db.admin, "videographer");
    inactiveManager = await createStaff(db.admin, "manager", { isActive: false });
    noProfile = await createAuthUser(db.admin);
  });
  afterAll(() => db.close());

  describe("права", () => {
    it("функции — сотрудникам API, не посетителю; хелперы закрыты; старой перегрузки нет", async () => {
      const { rows } = await db.admin.query<{ name: string; anon: boolean; authed: boolean }>(
        `select p.proname as name,
                has_function_privilege('anon', p.oid, 'execute') as anon,
                has_function_privilege('authenticated', p.oid, 'execute') as authed
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = any ($1)`,
        [[...Object.keys(WRITE_FUNCTIONS), "block_unit_rows"]],
      );
      expect(rows).toHaveLength(12);
      for (const row of rows) expect(row, row.name).toMatchObject({ anon: false, authed: true });

      const helpers = await db.admin.query<{ name: string; authed: boolean }>(
        `select p.proname as name, has_function_privilege('authenticated', p.oid, 'execute') as authed
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'private' and p.proname = any ($1)`,
        [
          [
            "lock_units_block",
            "block_unit_ids",
            "mute_unit_rows",
            "unmute_unit_rows",
            "write_units_summary",
            "removed_units_summary",
            "unit_price_columns",
          ],
        ],
      );
      expect(helpers.rows).toHaveLength(7);
      for (const row of helpers.rows) expect(row, row.name).toMatchObject({ authed: false });

      const old = await db.admin.query<{ old: string | null }>(
        "select to_regprocedure('public.set_units_status(uuid[], public.unit_status)')::text as old",
      );
      expect(old.rows[0]?.old).toBeNull();
    });

    it("видеограф, отключённый и пользователь без профиля — отказ во всех функциях записи", async () => {
      for (const actor of [videographer, inactiveManager, noProfile]) {
        for (const [name, expr] of Object.entries(WRITE_FUNCTIONS)) {
          const target = name === "set_layout_available" ? ids.oneRoomLayout : ids.publicBlock;
          await expectHint(callAs(db, actor, expr, [target]), "vh:forbidden");
        }
      }
    });

    it("менеджер — только статус, «Отменить» и наличие планировки (Н2, Н7)", async () => {
      for (const [name, expr] of Object.entries(WRITE_FUNCTIONS)) {
        if (MANAGER_FUNCTIONS.has(name)) continue;
        await expectHint(callAs(db, manager, expr, [ids.publicBlock]), "vh:forbidden");
      }
    });

    it("посетитель функции не вызывает; прямая запись в квартиры закрыта у роли API", async () => {
      await expectDenied(
        db.as(anon, (tx) =>
          tx.query("select set_units_status($1, '{}', 'sold')", [ids.publicBlock]),
        ),
      );
      await expectDenied(
        db.as(anon, (tx) => tx.query("select block_unit_rows($1)", [ids.publicBlock])),
      );
      const { rows } = await db.admin.query<Record<string, boolean>>(
        `select has_table_privilege('authenticated', 'public.units', 'insert') as ins,
                has_table_privilege('authenticated', 'public.units', 'update') as upd,
                has_table_privilege('authenticated', 'public.units', 'delete') as del,
                has_table_privilege('authenticated', 'public.units', 'select') as sel`,
      );
      expect(rows[0]).toEqual({ ins: false, upd: false, del: false, sel: true });
    });
  });

  describe("генератор (Н6)", () => {
    it("предел квартир в базе совпадает с кодом генератора", async () => {
      const { rows } = await db.admin.query<{ n: number }>("select private.unit_limit() as n");
      expect(rows[0]?.n).toBe(BLOCK_PLAN_LIMITS.totalUnits);
    });

    it("5000 квартир — одной транзакцией и одной записью; 5001 — отказ без вставки", async () => {
      const big: BlockPlan = {
        entrances: 50,
        floors: 100,
        firstResidentialFloor: 1,
        unitsPerFloor: Array(50).fill(1),
        startNumber: 1,
      };
      const tooBig = await newBlock(db.admin, ids.draftComplex, "Т", 100);
      const rows = [
        ...planRows(tooBig, big),
        { entrance: 1, floor: 1, position: 2, number: "5001", layout_id: null },
      ];
      await expectHint(
        callAs(db, head, "create_block_units($1, $2::jsonb)", [tooBig, JSON.stringify(rows)]),
        "vh:units_limit",
      );
      expect(await unitsOf(db.admin, tooBig)).toHaveLength(0);

      const started = performance.now();
      expect(await generate(db, head, tooBig, big)).toMatchObject({
        created: 5000,
        unassigned: 5000,
      });
      expect(performance.now() - started).toBeLessThan(15_000);
      const journal = await unitEntries(db.admin, tooBig);
      expect(journal).toHaveLength(1);
      expect(journal[0]?.changes.summary).toEqual({
        kind: "create",
        count: 5000,
        numbers: "1–5000",
        unassigned: 5000,
      });

      // «+ Квартира» в полный блок — тот же предел.
      await expectHint(
        callAs(db, head, "add_unit($1, 1, 1, 2, '5001')", [tooBig]),
        "vh:units_limit",
      );
    });

    it("неверные строки отклоняются целиком понятным кодом, без частичной вставки", async () => {
      const block = await newBlock(db.admin, ids.draftComplex, "Н", 5);
      const foreignLayout = await newLayout(db.admin, ids.draftBlock, 1, 40);
      const good = planRows(block, SMALL_PLAN);
      const cases: unknown[][] = [
        [],
        [{ ...good[0], floor: 6 }],
        [{ ...good[0], floor: 0 }],
        [{ ...good[0], entrance: 70_000 }],
        [{ ...good[0], position: 51 }],
        [{ ...good[0], number: "12 Б!" }],
        [{ ...good[0], layout_id: foreignLayout }],
      ];
      for (const rows of cases) {
        await expectHint(
          callAs(db, head, "create_block_units($1, $2::jsonb)", [block, JSON.stringify(rows)]),
          "vh:invalid",
        );
      }
      const duplicate = [good[0], { ...good[1], number: good[0]!.number }];
      await expect(
        callAs(db, head, "create_block_units($1, $2::jsonb)", [block, JSON.stringify(duplicate)]),
      ).rejects.toThrow(/duplicate key/);
      expect(await unitsOf(db.admin, block)).toHaveLength(0);

      const noFloors = await newBlock(db.admin, ids.draftComplex, "Б", null);
      await expectHint(generate(db, head, noFloors, SMALL_PLAN), "vh:invalid", "floors_total");
    });

    it("опубликованный ЖК: список без стояков снял бы «цену от» — отказ; со стояками — можно", async () => {
      const ready = await readyPublishedComplex(db.admin, ids.publicDeveloper, "ready-gen");
      const plan: BlockPlan = { ...SMALL_PLAN, unitsPerFloor: [1, 1] };
      await expectHint(generate(db, head, ready.blockId, plan), "vh:not_ready");
      expect(await unitsOf(db.admin, ready.blockId)).toHaveLength(0);

      expect(await generate(db, head, ready.blockId, plan, [ready.layoutId])).toMatchObject({
        created: 8,
        unassigned: 0,
      });
      await expectAvailabilityMatches(db, head, ready.complexId);
    });
  });

  describe("правка списка руководителем (Н4)", () => {
    let block: string;
    let oneRoom: string;
    let twoRoom: string;

    beforeAll(async () => {
      block = await newBlock(db.admin, ids.draftComplex, "П", 5);
      oneRoom = await newLayout(db.admin, block, 1, 42.5);
      twoRoom = await newLayout(db.admin, block, 2, 58.7);
      await generate(db, head, block, SMALL_PLAN, [oneRoom, twoRoom]);
    });

    it("«+ Квартира»: свободная без цены, построчная запись с номером и блоком", async () => {
      const added = await callAs<{ unit: { status: string; price: null } }>(
        db,
        head,
        "add_unit($1, 2, 5, 3, '17', $2)",
        [block, twoRoom],
      );
      expect(added.unit).toMatchObject({ status: "free", price: null, number: "17" });
      const entry = (await unitEntries(db.admin, block)).at(-1);
      expect(entry).toMatchObject({
        action: "insert",
        actor_id: head,
        changes: { number: "17", block_name: "П", currency: "USD", layout: "2-комн. · 58,7 м²" },
      });

      const add = (expr: string, params: unknown[] = [block]) => callAs(db, head, expr, params);
      await expectHint(add("add_unit($1, 2, 5, 3, '18')"), "vh:unit_taken", "slot");
      await expectHint(add("add_unit($1, 2, 5, 4, '17')"), "vh:unit_taken", "number");
      for (const floor of [0, 6]) {
        await expectHint(add("add_unit($1, 1, $2, 4, '99')", [block, floor]), "vh:invalid", "slot");
      }
      await expectHint(add("add_unit($1, 1, 5, 4, '12 Б!')"), "vh:invalid", "number");
      const foreign = await newLayout(db.admin, ids.draftBlock, 2, 50);
      await expectHint(
        add("add_unit($1, 1, 5, 4, '99', $2)", [block, foreign]),
        "vh:invalid",
        "layout_id",
      );
      await expectHint(
        add("add_unit($1, 1, 2, 1, '1')", [ids.draftBlock]),
        "vh:invalid",
        "no_list",
      );
    });

    it("правка строки меняет только переданные поля и пишет номер, блок и подпись планировки", async () => {
      const unit = await unitByNumber(db.admin, block, "3");
      await callAs(db, head, "set_units_price($1, $2, 'total', 41000)", [block, [unit.id]]);
      await callAs(db, head, "update_unit($1, $2, $3::jsonb)", [
        block,
        unit.id,
        JSON.stringify({ number: "3А", layout_id: twoRoom }),
      ]);
      expect(await unitByNumber(db.admin, block, "3А")).toMatchObject({
        price: "41000.00",
        layout_id: twoRoom,
      });

      const entry = (await unitEntries(db.admin, block)).at(-1);
      expect(entry?.changes).toMatchObject({
        number: ["3", "3А"],
        block_name: "П",
        layout: ["1-комн. · 42,5 м²", "2-комн. · 58,7 м²"],
      });
      const journal = await callAs<{ subject: string }[]>(
        db,
        head,
        "(select jsonb_agg(j) from journal_entries(null, null, 5, $1) j where j.entity_id = $2)",
        [ids.draftComplex, unit.id],
      );
      expect(journal[0]?.subject).toBe("Блок П · кв. 3А");
    });

    it("правка строки: неверное и чужое — понятный отказ", async () => {
      const unit = await unitByNumber(db.admin, block, "4");
      const foreign = await newLayout(db.admin, ids.draftBlock, 3, 80);
      await db.admin.query(
        'insert into finishings (slug, name, is_active) values (\'hidden-f\', \'{"ru": "Скрытая", "uz": "Yashirin"}\', false)',
      );
      const hidden = (
        await db.admin.query<{ id: number }>("select id from finishings where slug = 'hidden-f'")
      ).rows[0]!.id;
      const update = (patch: object, target = block) =>
        callAs(db, head, "update_unit($1, $2, $3::jsonb)", [
          target,
          unit.id,
          JSON.stringify(patch),
        ]);
      const patches: [object, string | undefined][] = [
        [{ status: "sold" }, undefined],
        [{ number: "" }, "number"],
        [{ price: { mode: "total", value: 0 } }, "price"],
        [{ price: { mode: "per_m2", value: -5 } }, "price"],
        [{ price: { mode: "both", value: 1 } }, "price"],
        [{ layout_id: foreign }, "layout_id"],
        [{ finishing_id: hidden }, "finishing_id"],
      ];
      for (const [patch, detail] of patches) {
        await expectHint(update(patch), "vh:invalid", detail);
      }
      await expectHint(update({ number: "5" }), "vh:unit_taken", "number");
      await expectHint(update({}, ids.draftBlock), "vh:not_found");

      // Отделку скрыли в справочнике уже после назначения — правка других полей её не сбрасывает.
      await db.admin.query("update units set finishing_id = $2 where id = $1", [unit.id, hidden]);
      await update({ number: "4Б", finishing_id: hidden });
      expect(await unitByNumber(db.admin, block, "4Б")).toMatchObject({ finishing_id: hidden });
    });

    it("удаление выделенных — одна запись со статусами; весь список так не удаляется", async () => {
      const units = await unitsOf(db.admin, block);
      const [first, second, third] = units;
      await callAs(db, manager, "set_units_status($1, $2, 'reserved')", [block, [second!.id]]);
      await callAs(db, manager, "set_units_status($1, $2, 'sold')", [block, [third!.id]]);
      const before = (await unitEntries(db.admin, block)).length;

      const result = await callAs(db, head, "delete_units($1, $2)", [
        block,
        [first!.id, second!.id, third!.id],
      ]);
      expect(result).toMatchObject({ deleted: 3 });
      const journal = await unitEntries(db.admin, block);
      expect(journal).toHaveLength(before + 1);
      expect(journal.at(-1)).toMatchObject({
        action: "delete",
        entity_id: block,
        changes: {
          summary: {
            kind: "delete",
            count: 3,
            statuses: { free: 1, reserved: 1, sold: 1 },
            reserved_numbers: second!.number,
            sold_numbers: third!.number,
          },
        },
      });

      const left = await unitsOf(db.admin, block);
      await expectHint(
        callAs(db, head, "delete_units($1, $2)", [block, left.map((unit) => unit.id)]),
        "vh:whole_list",
      );
      await expectHint(
        callAs(db, head, "delete_units($1, $2)", [block, [first!.id]]),
        "vh:not_found",
      );
      expect(await unitsOf(db.admin, block)).toHaveLength(left.length);
    });

    it("опубликованный ЖК: удаление, которое сняло бы «цену от», откатывается", async () => {
      const ready = await readyPublishedComplex(db.admin, ids.publicDeveloper, "ready-del");
      await generate(db, head, ready.blockId, { ...SMALL_PLAN, unitsPerFloor: [1, 1] }, [
        ready.layoutId,
      ]);
      await db.admin.query("update layouts set price_from = null where id = $1", [ready.layoutId]);
      const units = await unitsOf(db.admin, ready.blockId);
      await callAs(db, head, "set_units_price($1, $2, 'total', 35000)", [
        ready.blockId,
        [units[0]!.id],
      ]);
      const priced = units[0]!.id;
      await expectHint(
        callAs(db, head, "delete_units($1, $2)", [ready.blockId, [priced]]),
        "vh:not_ready",
      );
      // Снять единственную цену или планировку этой квартиры — тоже «хуже».
      await expectHint(
        callAs(db, head, "set_units_price($1, $2, 'none')", [ready.blockId, [priced]]),
        "vh:not_ready",
      );
      for (const patch of [{ price: { mode: "none", value: null } }, { layout_id: null }]) {
        await expectHint(
          callAs(db, head, "update_unit($1, $2, $3::jsonb)", [
            ready.blockId,
            priced,
            JSON.stringify(patch),
          ]),
          "vh:not_ready",
        );
      }
      expect(await unitsOf(db.admin, ready.blockId)).toHaveLength(units.length);
      expect((await unitsOf(db.admin, ready.blockId))[0]).toMatchObject({
        price: "35000.00",
        layout_id: ready.layoutId,
      });

      // «Удалить список блока» переносит цену свободной квартиры в «цену от» — ЖК остаётся готовым.
      const name = (
        await db.admin.query<{ name: string }>("select name from blocks where id = $1", [
          ready.blockId,
        ])
      ).rows[0]!.name;
      await callAs(db, head, "delete_block_units($1, $2)", [ready.blockId, name]);
      const layout = await db.admin.query<{ price_from: string }>(
        "select price_from from layouts where id = $1",
        [ready.layoutId],
      );
      expect(layout.rows[0]?.price_from).toBe("35000.00");
    });

    it("подпись квартиры в журнале переживает её удаление", async () => {
      const unit = await unitByNumber(db.admin, block, "14");
      const price = JSON.stringify({ price: { mode: "total", value: 50000 } });
      await callAs(db, head, "update_unit($1, $2, $3::jsonb)", [block, unit.id, price]);
      await callAs(db, head, "delete_units($1, $2)", [block, [unit.id]]);
      const subjects = await callAs<string[]>(
        db,
        head,
        "(select jsonb_agg(j.subject) from journal_entries(null, null, 50, $1) j where j.entity_id = $2)",
        [ids.draftComplex, unit.id],
      );
      expect(subjects).toEqual(["Блок П · кв. 14"]);
    });
  });

  describe("чтение списка для кабинета", () => {
    it("block_unit_rows — все квартиры одним значением, по порядку номеров, с именем автора", async () => {
      const block = await newBlock(db.admin, ids.draftComplex, "Ч", 5);
      await generate(db, head, block, SMALL_PLAN);
      await callAs(db, head, "add_unit($1, 1, 5, 3, '12А')", [block]);
      const unit = await unitByNumber(db.admin, block, "10");
      await callAs(db, manager, "set_units_status($1, $2, 'sold')", [block, [unit.id]]);

      const rows = await callAs<
        { number: string; updated_by_name: string | null; status: string }[]
      >(db, videographer, "block_unit_rows($1)", [block]);
      expect(rows.map((row) => row.number)).toEqual([
        ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
        "12А",
        "13",
        "14",
        "15",
        "16",
      ]);
      expect(rows.find((row) => row.number === "10")).toMatchObject({
        status: "sold",
        updated_by_name: "Дилноза Юсупова",
      });
      expect(await callAs(db, noProfile, "block_unit_rows($1)", [block])).toEqual([]);
    });
  });

  it("каждая функция, что пишет квартиры, берёт замок ЖК до чтения и глушит журнал парно", async () => {
    const sql = await readFile(
      path.resolve(import.meta.dirname, "../../supabase/migrations/20261021120000_units_admin.sql"),
      "utf8",
    );
    // Без комментариев: закомментированный вызов замка не должен засчитываться.
    const bodies = sql
      .replace(/--.*$/gm, "")
      .split(/\ncreate (?:or replace )?function /)
      .slice(1);
    const nameOf = (body: string) => body.slice(0, body.indexOf("("));
    const writers = bodies.filter(
      (body) =>
        /^public\./.test(body) && /(insert into|update|delete from) public\.units\b/.test(body),
    );
    expect(writers.map(nameOf).sort()).toEqual(
      [
        "public.add_unit",
        "public.create_block_units",
        "public.delete_block_units",
        "public.delete_units",
        "public.revert_units_status",
        "public.set_units_finishing",
        "public.set_units_layouts",
        "public.set_units_price",
        "public.set_units_status",
        "public.update_unit",
      ].sort(),
    );
    // Замок — до первого чтения квартир: проверка «есть ли список» под замком, иначе гонка с
    // удалением списка. Наличие планировки (Н7) тоже читает квартиры.
    const lockers = [
      ...writers,
      bodies.find((body) => nameOf(body) === "public.set_layout_available")!,
    ];
    for (const body of lockers) {
      const lock = body.indexOf("private.lock_units_block(");
      const firstRead = body.search(
        /\b(from|join|into|update)\s+public\.units\b|private\.block_unit_ids\(/,
      );
      expect(lock, nameOf(body)).toBeGreaterThan(0);
      expect(lock, nameOf(body)).toBeLessThan(firstRead);
    }
    // Пакетные функции: флаг ставится и возвращается к прежнему значению ровно парами.
    for (const body of writers.filter((b) => !/^public\.(add_unit|update_unit)\(/.test(b))) {
      const mutes = body.match(/previous := private\.mute_unit_rows\(\);/g) ?? [];
      const unmutes = body.match(/private\.unmute_unit_rows\([^)]*\)/g) ?? [];
      expect(mutes.length, nameOf(body)).toBeGreaterThan(0);
      expect(unmutes, nameOf(body)).toEqual(mutes.map(() => "private.unmute_unit_rows(previous)"));
    }
  });

  it("ответ каждой функции называет ЖК — по нему сбрасывается кэш сайта (12.2)", async () => {
    const block = await newBlock(db.admin, ids.draftComplex, "К", 5);
    const layout = await newLayout(db.admin, block, 1, 40);
    const manual = await newBlock(db.admin, ids.draftComplex, "Р", 5);
    const manualLayout = await newLayout(db.admin, manual, 2, 60);
    const own = { complex_id: ids.draftComplex };
    expect(await generate(db, head, block, SMALL_PLAN)).toMatchObject(own);
    const [first, second] = await unitsOf(db.admin, block);
    const status = await callAs<{ undo: unknown }>(
      db,
      manager,
      "set_units_status($1, $2, 'sold')",
      [block, [first!.id]],
    );
    expect(status).toMatchObject(own);
    const calls: [string, unknown[]][] = [
      ["revert_units_status($1, 'sold', $2::jsonb)", [block, JSON.stringify(status.undo)]],
      ["add_unit($1, 1, 5, 3, '17')", [block]],
      ['update_unit($1, $2, \'{"number": "1А"}\'::jsonb)', [block, first!.id]],
      ["set_units_price($1, $2, 'total', 30000)", [block, [first!.id]]],
      ["set_units_finishing($1, $2, null)", [block, [first!.id]]],
      [
        "set_units_layouts($1, $2::jsonb)",
        [block, JSON.stringify([{ id: first!.id, layout_id: layout }])],
      ],
      ["delete_units($1, $2)", [block, [second!.id]]],
      ["delete_block_units($1, 'К')", [block]],
      ["set_layout_available($1, false)", [manualLayout]],
    ];
    for (const [expr, params] of calls) {
      expect(await callAs(db, head, expr, params), expr).toMatchObject(own);
    }
    expect(await callAs(db, manager, "set_units_status(null, '{}', 'sold')")).toEqual({
      complex_id: null,
      changed: 0,
      undo: [],
    });
  });
});
