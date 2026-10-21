import { expect } from "vitest";
import {
  applyRisers,
  defaultRisers,
  generateUnits,
  toUnitInsertRows,
  type BlockPlan,
} from "@/lib/units";
import { makeComplexReady } from "./content-fixtures";
import { user, type Db, type TestDb } from "./harness";

// Общее для тестов функций квартир шага 12 (миграция 20261021120000_units_admin.sql).

export type UnitRow = {
  id: string;
  entrance: number;
  floor: number;
  position: number;
  number: string;
  layout_id: string | null;
  price: string | null;
  price_per_m2: string | null;
  finishing_id: number | null;
  status: "free" | "reserved" | "sold";
  updated_by: string | null;
};

export type JournalRow = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  complex_id: string | null;
  changes: Record<string, unknown> & { summary?: Record<string, unknown> };
};

/** 2 подъезда × этажи 2–5 × 2 квартиры = 16 квартир, № 1–16. */
export const SMALL_PLAN: BlockPlan = {
  entrances: 2,
  floors: 5,
  firstResidentialFloor: 2,
  unitsPerFloor: [2, 2],
  startNumber: 1,
};

async function insertId(admin: Db, sql: string, params: unknown[]): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(`${sql} returning id`, params);
  return rows[0]!.id;
}

export function newBlock(admin: Db, complexId: string, name: string, floors: number | null = 16) {
  return insertId(
    admin,
    "insert into blocks (complex_id, name, floors_total) values ($1, $2, $3)",
    [complexId, name, floors],
  );
}

export function newLayout(
  admin: Db,
  blockId: string,
  rooms: number,
  area: number,
  priceFrom: number | null = null,
) {
  return insertId(
    admin,
    "insert into layouts (block_id, rooms, area, price_from) values ($1, $2, $3, $4)",
    [blockId, rooms, area, priceFrom],
  );
}

/** Строки генератора, как их считает кабинет: стояк позиции i — планировка layoutIds[i]. */
export function planRows(blockId: string, plan: BlockPlan, layoutIds: readonly string[] = []) {
  const risers = defaultRisers(plan).map((riser, index) => ({
    ...riser,
    layoutId: layoutIds[index] ?? null,
  }));
  return toUnitInsertRows(blockId, applyRisers(generateUnits(plan), risers));
}

/** Вызов функции от имени сотрудника: `select <expr> as result`, ответ jsonb — объект. */
export async function callAs<T = Record<string, unknown>>(
  db: TestDb,
  actorId: string,
  expr: string,
  params: unknown[] = [],
): Promise<T> {
  const { rows } = await db.as(user(actorId), (tx) =>
    tx.query<{ result: T }>(`select ${expr} as result`, params),
  );
  return rows[0]!.result;
}

export function generate(
  db: TestDb,
  headId: string,
  blockId: string,
  plan: BlockPlan,
  layoutIds: readonly string[] = [],
) {
  return callAs(db, headId, "create_block_units($1, $2::jsonb)", [
    blockId,
    JSON.stringify(planRows(blockId, plan, layoutIds)),
  ]);
}

export async function unitsOf(admin: Db, blockId: string): Promise<UnitRow[]> {
  const { rows } = await admin.query<UnitRow>(
    "select * from units where block_id = $1 order by entrance, floor, position",
    [blockId],
  );
  return rows;
}

export async function unitByNumber(admin: Db, blockId: string, number: string): Promise<UnitRow> {
  const { rows } = await admin.query<UnitRow>(
    "select * from units where block_id = $1 and number = $2",
    [blockId, number],
  );
  return rows[0]!;
}

/** Записи журнала о квартирах блока: сводки (entity_id — блок) и построчные (block_id в записи). */
export async function unitEntries(admin: Db, blockId: string): Promise<JournalRow[]> {
  const { rows } = await admin.query<JournalRow>(
    `select id, actor_id, action, entity, entity_id, complex_id, changes from audit_log
     where entity = 'units' and (entity_id = $1 or changes ->> 'block_id' = $1)
     order by id`,
    [blockId],
  );
  return rows;
}

export async function lastAuditId(admin: Db): Promise<number> {
  const { rows } = await admin.query<{ id: number }>(
    "select coalesce(max(id), 0)::int as id from audit_log",
  );
  return rows[0]!.id;
}

/** «Осталось N» у каждой планировки блоков со списком совпадает с прямым подсчётом. */
export async function expectAvailabilityMatches(db: TestDb, staffId: string, complexId: string) {
  const expected = await db.admin.query<{ layout_id: string; free: number }>(
    `select l.id as layout_id, count(u.id) filter (where u.status = 'free')::int as free
     from layouts l join blocks b on b.id = l.block_id left join units u on u.layout_id = l.id
     where b.complex_id = $1 and exists (select 1 from units x where x.block_id = b.id)
     group by l.id`,
    [complexId],
  );
  const { rows } = await db.as(user(staffId), (tx) =>
    tx.query<{ layout_id: string; free_count: number }>(
      "select layout_id, free_count from layout_availability($1)",
      [complexId],
    ),
  );
  const actual = new Map(rows.map((row) => [row.layout_id, row.free_count]));
  for (const row of expected.rows) expect(actual.get(row.layout_id)).toBe(row.free);
}

/**
 * Опубликованный ЖК, где «цену от» держит одна планировка — блок R (makeComplexReady): чертёж и
 * ручная «цена от» 30 000. Права на «не делает хуже» проверяются на нём.
 */
export async function readyPublishedComplex(admin: Db, developerId: string, slug: string) {
  const complexId = await insertId(
    admin,
    `insert into complexes (developer_id, slug, name, status, files_checked_at)
     values ($1, $2, jsonb_build_object('ru', $2::text, 'uz', $2::text), 'published', now())`,
    [developerId, slug],
  );
  await makeComplexReady(admin, complexId);
  const { rows } = await admin.query<{ block_id: string; layout_id: string }>(
    `select b.id as block_id, l.id as layout_id from blocks b join layouts l on l.block_id = b.id
     where b.complex_id = $1 and b.name = 'R'`,
    [complexId],
  );
  return { complexId, blockId: rows[0]!.block_id, layoutId: rows[0]!.layout_id };
}
