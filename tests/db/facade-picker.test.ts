import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  user,
  type Db,
  type TestDb,
} from "./harness";

// Фаза 4 (4.1): «Выбрать квартиру» на фасаде (миграции 20261029010000_media_floor_plan.sql и
// 20261029020000_facade_picker.sql) — фасад ЖК, контуры блоков, планы этажей с контурами квартир,
// права руководителя, правило 1.2, что видит сайт, журнал.

const RECT = [
  [10, 10],
  [40, 10],
  [40, 60],
  [10, 60],
];

const pathIn = (complex: string, ext = "png") => `complexes/${complex}/${crypto.randomUUID()}.${ext}`;

describe("фасад и планы этажей: права, правила и сайт", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);
  const call = <T = Record<string, unknown>>(tx: Db, sql: string, params: unknown[]) =>
    tx.query<{ r: T }>(`select ${sql} as r`, params).then((result) => result.rows[0]!.r);

  const setFacade = (tx: Db, complex = ids.publicComplex, rule12 = true) =>
    call<{ complex_id: string; old_path: string | null }>(
      tx,
      "public.set_complex_facade($1, $2, 2400, 1600, null, $3)",
      [complex, pathIn(complex, "jpg"), rule12],
    );
  const savePlan = (tx: Db, plan: string | null, entrance: number | null, from: number, to: number, withImage = true) =>
    call<{ id: string; complex_id: string; old_path: string | null }>(
      tx,
      "public.save_floor_plan($1, $2, $3::smallint, $4::smallint, $5::smallint, $6, $7, $8, null, true)",
      [plan, ids.publicBlock, entrance, from, to, withImage ? pathIn(ids.publicComplex) : null, withImage ? 1600 : null, withImage ? 1200 : null],
    );
  const contours = (entrance: number, ...positions: number[]) =>
    JSON.stringify(positions.map((position) => ({ entrance, position, points: RECT })));

  describe("фасад и контуры блоков", () => {
    it("фасад и контур ставит руководитель; менеджер и посетитель — отказ; без 1.2 у опубликованного — отказ", async () => {
      await expectHint(asHead((tx) => setFacade(tx, ids.publicComplex, false)), "vh:rule12");
      await expectHint(db.as(user(manager), (tx) => setFacade(tx)), "vh:forbidden");
      await expectDenied(db.as(anon, (tx) => setFacade(tx)));
      const first = await asHead((tx) => setFacade(tx));
      expect(first).toEqual({ complex_id: ids.publicComplex, old_path: null });
      const contour = await asHead((tx) =>
        call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.publicBlock, JSON.stringify(RECT)]),
      );
      expect(contour).toEqual({ complex_id: ids.publicComplex });
      await expectHint(
        db.as(user(manager), (tx) => call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.publicBlock, null])),
        "vh:forbidden",
      );
    });

    it("контур — 3–40 точек в процентах 0–100; без фасада контура нет", async () => {
      for (const bad of [[[1, 1], [2, 2]], [[1, 1], [2, 2], [101, 3]], [[1, 1], [2, 2], ["3", 3]]]) {
        await expect(
          asHead((tx) => call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.publicBlock, JSON.stringify(bad)])),
        ).rejects.toThrow(/facade_contour|check/);
      }
      await expectHint(
        asHead((tx) => call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.draftBlock, JSON.stringify(RECT)])),
        "vh:not_ready",
      );
    });

    it("новый фасад снимает контуры блоков и возвращает путь старого файла", async () => {
      const replaced = await asHead(async (tx) => {
        const before = await setFacade(tx);
        await call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.publicBlock, JSON.stringify(RECT)]);
        const after = await setFacade(tx);
        const left = await tx.query<{ facade_contour: unknown }>("select facade_contour from blocks where id = $1", [ids.publicBlock]);
        return { before, after, contour: left.rows[0]!.facade_contour };
      });
      expect(replaced.after.old_path).toMatch(/^complexes\//);
      expect(replaced.after.old_path).not.toBe(replaced.before.old_path);
      expect(replaced.contour).toBeNull();
    });
  });

  describe("планы этажей", () => {
    // План каждого теста убирается: этажи следующего иначе пересеклись бы с ним.
    afterEach(() => db.admin.query("delete from floor_plans"));

    it("новый план — с картинкой; этажи не пересекаются с планом того же подъезда или всего этажа", async () => {
      await expectHint(asHead((tx) => savePlan(tx, null, 1, 2, 5, false)), "vh:invalid");
      const result = await asHead(async (tx) => {
        const first = await savePlan(tx, null, 1, 2, 9);
        const second = await savePlan(tx, null, 2, 2, 9);
        return { first, second };
      });
      expect(result.first.complex_id).toBe(ids.publicComplex);
      await expectHint(
        asHead(async (tx) => {
          await savePlan(tx, null, 1, 2, 9);
          return savePlan(tx, null, 1, 9, 12);
        }),
        "vh:duplicate",
      );
      await expectHint(
        asHead(async (tx) => {
          await savePlan(tx, null, 1, 2, 9);
          return savePlan(tx, null, null, 5, 6);
        }),
        "vh:duplicate",
      );
      // Блок A — 16 этажей.
      await expectHint(asHead((tx) => savePlan(tx, null, 1, 10, 17)), "vh:invalid");
      await expectHint(db.as(user(manager), (tx) => savePlan(tx, null, 1, 2, 3)), "vh:forbidden");
    });

    it("контуры квартир: свой подъезд, место один раз; новая картинка сбрасывает контуры", async () => {
      const outcome = await asHead(async (tx) => {
        const plan = await savePlan(tx, null, 1, 2, 4);
        await call(tx, "public.set_floor_plan_contours($1, $2::jsonb)", [plan.id, contours(1, 1, 2, 3, 4)]);
        const saved = await tx.query<{ n: number }>("select jsonb_array_length(contours) as n from floor_plans where id = $1", [plan.id]);
        const replaced = await savePlan(tx, plan.id, 1, 2, 5);
        const after = await tx.query<{ n: number }>("select jsonb_array_length(contours) as n from floor_plans where id = $1", [plan.id]);
        const kept = await savePlan(tx, plan.id, 1, 2, 6, false);
        return { saved: saved.rows[0]!.n, replaced, after: after.rows[0]!.n, kept };
      });
      expect(outcome.saved).toBe(4);
      expect(outcome.replaced.old_path).toMatch(/^complexes\//);
      expect(outcome.after).toBe(0);
      expect(outcome.kept.old_path).toBeNull();
      await expectHint(
        asHead(async (tx) => {
          const plan = await savePlan(tx, null, 1, 10, 11);
          return call(tx, "public.set_floor_plan_contours($1, $2::jsonb)", [plan.id, contours(2, 1)]);
        }),
        "vh:invalid",
      );
      await expectHint(
        asHead(async (tx) => {
          const plan = await savePlan(tx, null, 1, 12, 13);
          return call(tx, "public.set_floor_plan_contours($1, $2::jsonb)", [plan.id, contours(1, 1, 1)]);
        }),
        "vh:invalid",
      );
    });

    it("план подъезда оставляет только свои контуры; прямая запись в таблицу закрыта", async () => {
      const left = await asHead(async (tx) => {
        const plan = await savePlan(tx, null, null, 2, 3);
        await call(tx, "public.set_floor_plan_contours($1, $2::jsonb)", [
          plan.id,
          JSON.stringify([...JSON.parse(contours(1, 1)), ...JSON.parse(contours(2, 1))]),
        ]);
        await savePlan(tx, plan.id, 1, 2, 3, false);
        const row = await tx.query<{ contours: { entrance: number }[] }>("select contours from floor_plans where id = $1", [plan.id]);
        return row.rows[0]!.contours.map((item) => item.entrance);
      });
      expect(left).toEqual([1]);
      await expectDenied(asHead((tx) => tx.query("update floor_plans set floor_to = 3")));
      await expectDenied(db.as(user(manager), (tx) => tx.query("delete from floor_plans")));
    });

    it("удаление плана убирает картинку и возвращает путь; запись — в журнале ЖК", async () => {
      const outcome = await asHead(async (tx) => {
        const plan = await savePlan(tx, null, null, 2, 3);
        const removed = await call<{ complex_id: string; old_path: string }>(tx, "public.delete_floor_plan($1)", [plan.id]);
        const left = await tx.query<{ n: number }>("select count(*)::int as n from floor_plans where id = $1", [plan.id]);
        return { plan, removed, left: left.rows[0]!.n };
      });
      expect(outcome.removed.old_path).toMatch(/^complexes\//);
      expect(outcome.left).toBe(0);
      const audit = await db.admin.query<{ action: string; complex_id: string }>(
        "select action, complex_id from audit_log where entity = 'floor_plans' and entity_id = $1 order by id",
        [outcome.plan.id],
      );
      expect(audit.rows.map((row) => row.action)).toEqual(["insert", "delete"]);
      expect(audit.rows.every((row) => row.complex_id === ids.publicComplex)).toBe(true);
    });
    it("удалённый блок уносит свои планы и их картинки", async () => {
      const block = (
        await db.admin.query<{ id: string }>(
          "insert into blocks (complex_id, name, floors_total) values ($1, 'Z', 5) returning id",
          [ids.publicComplex],
        )
      ).rows[0]!.id;
      const plan = await asHead((tx) =>
        call<{ id: string }>(tx, "public.save_floor_plan(null, $1, null, 2::smallint, 3::smallint, $2, 1600, 1200, null, true)", [
          block,
          pathIn(ids.publicComplex),
        ]),
      );
      const image = (await db.admin.query<{ image_id: string }>("select image_id from floor_plans where id = $1", [plan.id])).rows[0]!.image_id;
      await db.admin.query("delete from blocks where id = $1", [block]);
      const left = await db.admin.query<{ n: number }>("select count(*)::int as n from media_assets where id = $1", [image]);
      expect(left.rows[0]!.n).toBe(0);
    });
  });

  describe("сайт", () => {
    it("site_complex_picker: фасад, контуры и планы опубликованного ЖК; черновик посетителю — null", async () => {
      await asHead(async (tx) => {
        await setFacade(tx);
        await call(tx, "public.set_block_contour($1, $2::jsonb)", [ids.publicBlock, JSON.stringify(RECT)]);
        const plan = await savePlan(tx, null, 1, 2, 4);
        await call(tx, "public.set_floor_plan_contours($1, $2::jsonb)", [plan.id, contours(1, 1, 2)]);
      });
      const picker = await db.as(anon, (tx) =>
        call<{ facade: { path: string } | null; blocks: { id: string }[]; plans: { contours: unknown[] }[] }>(
          tx,
          "public.site_complex_picker($1)",
          [ids.publicComplex],
        ),
      );
      expect(picker.facade?.path).toMatch(/^complexes\//);
      expect(picker.blocks.map((block) => block.id)).toEqual([ids.publicBlock]);
      expect(picker.plans).toHaveLength(1);
      expect(picker.plans[0]!.contours).toHaveLength(2);
      expect(await db.as(anon, (tx) => call(tx, "public.site_complex_picker($1)", [ids.draftComplex]))).toBeNull();
      const visible = await db.as(anon, (tx) =>
        tx.query<{ n: number }>("select count(*)::int as n from floor_plans where complex_id = $1", [ids.publicComplex]),
      );
      expect(visible.rows[0]!.n).toBe(1);
      await db.admin.query("delete from floor_plans");
    });
  });
});
