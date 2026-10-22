import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  user,
  type Actor,
  type TestDb,
} from "./harness";

type LayoutRow = {
  layout_id: string;
  block_id: string;
  rooms: number;
  free_count: number | null;
  available: boolean;
  price_from: string | null;
  currency: string;
};
type RoomRow = {
  complex_id: string;
  rooms: number;
  currency: string;
  free_count: number | null;
  available: boolean;
  area_from: string | null;
  price_from: string | null;
};
type BlockRow = {
  complex_id: string;
  block_id: string;
  name: string;
  free_count: number | null;
  available: boolean;
};

// Функции наличия для сайта — PLAN §5, приёмка фазы 1: «осталось N» совпадает с SQL-подсчётом.
describe("наличие квартир для сайта", () => {
  let db: TestDb;
  let ids: ContentIds;
  let videographer: string;
  let generatedBlock: string;
  let manualBlock: string;
  let unassignedUnit: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    videographer = await createStaff(db.admin, "videographer");
    ({ generatedBlock, unassignedUnit } = await seedGeneratedBlock(db, ids.publicComplex));
    manualBlock = await seedManualBlock(db, ids.publicComplex);
  });
  afterAll(() => db.close());

  const call = async <T>(actor: Actor, sql: string, params: unknown[]) =>
    (await db.as(actor, (tx) => tx.query<T>(sql, params))).rows;
  const layouts = (actor: Actor, complex: string) =>
    call<LayoutRow>(actor, "select * from layout_availability($1)", [complex]);
  const rooms = (actor: Actor, complexes: string[]) =>
    call<RoomRow>(actor, "select * from room_availability($1)", [complexes]);
  const blockRows = (actor: Actor, complexes: string[]) =>
    call<BlockRow>(actor, "select * from block_availability($1)", [complexes]);

  it("«осталось N» по каждой планировке совпадает с прямым подсчётом", async () => {
    const expected = await db.admin.query<{ layout_id: string; free: number }>(
      `select l.id as layout_id, count(u.id) filter (where u.status = 'free')::int as free
       from layouts l join blocks b on b.id = l.block_id left join units u on u.layout_id = l.id
       where b.complex_id = $1 and b.id <> $2
       group by l.id`,
      [ids.publicComplex, manualBlock],
    );
    const actual = new Map(
      (await layouts(anon, ids.publicComplex)).map((row) => [row.layout_id, row]),
    );
    expect(expected.rows.length).toBeGreaterThan(4);
    for (const row of expected.rows) {
      expect(actual.get(row.layout_id)).toMatchObject({
        free_count: row.free,
        available: row.free > 0,
      });
    }
  });

  it("«осталось N» по типам совпадает с прямым подсчётом по свободным квартирам", async () => {
    const expected = await db.admin.query<{ rooms: number; free: number }>(
      `select l.rooms, count(*)::int as free
       from units u join layouts l on l.id = u.layout_id join blocks b on b.id = u.block_id
       where b.complex_id = $1 and u.status = 'free' and b.currency = 'USD'
       group by l.rooms`,
      [ids.publicComplex],
    );
    const actual = (await rooms(anon, [ids.publicComplex])).filter((row) => row.currency === "USD");
    expect(actual.map((row) => [row.rooms, row.free_count])).toEqual(
      expected.rows.map((row) => [row.rooms, row.free]).sort(([a], [b]) => Number(a) - Number(b)),
    );
  });

  it("«цена от» — минимум по свободным: целиком или цена за м² × площадь", async () => {
    const expected = await db.admin.query<{ layout_id: string; min: string }>(
      `select u.layout_id, min(coalesce(u.price, u.price_per_m2 * l.area))::text as min
       from units u join layouts l on l.id = u.layout_id
       where u.block_id = $1 and u.status = 'free'
       group by u.layout_id
       having min(coalesce(u.price, u.price_per_m2 * l.area)) is not null`,
      [generatedBlock],
    );
    const actual = new Map(
      (await layouts(anon, ids.publicComplex)).map((row) => [row.layout_id, row]),
    );
    // 1-комн. и обе 2-комн. — с ценами; 3-комн. без цен проверяется отдельно (цена планировки).
    expect(expected.rows).toHaveLength(3);
    for (const row of expected.rows) {
      expect(Number(actual.get(row.layout_id)?.price_from)).toBe(Number(row.min));
    }
  });

  it("малый блок посчитан вручную: распроданный тип — «нет в наличии» без цены", async () => {
    const byLayout = new Map(
      (await layouts(anon, ids.publicComplex)).map((row) => [row.layout_id, row]),
    );
    expect(byLayout.get(ids.oneRoomLayout)).toMatchObject({
      free_count: 2,
      available: true,
      price_from: "30000.00",
    });
    expect(byLayout.get(ids.twoRoomLayout)).toMatchObject({
      free_count: 0,
      available: false,
      price_from: null,
    });
  });

  it("свободные квартиры без цены — «цена от» берётся у планировки", async () => {
    const threeRoom = (await layouts(anon, ids.publicComplex)).find(
      (row) => row.block_id === generatedBlock && row.rooms === 3,
    );
    expect(threeRoom?.price_from).toBe("70000.00");
  });

  it("блок без списка квартир: ручной флаг и цена, без числа", async () => {
    const manual = (await layouts(anon, ids.publicComplex)).filter(
      (row) => row.block_id === manualBlock,
    );
    expect(
      manual.map(({ rooms, free_count, available, price_from, currency }) => ({
        rooms,
        free_count,
        available,
        price_from,
        currency,
      })),
    ).toEqual([
      { rooms: 1, free_count: null, available: true, price_from: "350000000.00", currency: "UZS" },
      { rooms: 4, free_count: null, available: false, price_from: null, currency: "UZS" },
    ]);
    const uzs = (await rooms(anon, [ids.publicComplex])).filter((row) => row.currency === "UZS");
    expect(uzs).toMatchObject([
      { rooms: 1, free_count: null, available: true },
      { rooms: 4, free_count: 0, available: false, price_from: null },
    ]);
  });

  it("итог по блокам считает и квартиры без планировки", async () => {
    const expected = await db.admin.query<{ free: number }>(
      "select count(*)::int as free from units where block_id = $1 and status = 'free'",
      [generatedBlock],
    );
    const blocks = await blockRows(anon, [ids.publicComplex]);
    const byBlock = new Map(blocks.map((row) => [row.block_id, row]));
    expect(byBlock.get(generatedBlock)).toMatchObject({
      complex_id: ids.publicComplex,
      free_count: expected.rows[0]?.free,
      available: true,
    });
    expect(byBlock.get(ids.publicBlock)).toMatchObject({ free_count: 2, available: true });
    // Без списка: числа нет, «есть что предложить» — по флагу «доступна» планировок.
    expect(byBlock.get(manualBlock)).toMatchObject({ free_count: null, available: true });
  });

  it("по блокам — сразу для нескольких ЖК (главная кабинета, Г4): сайту только опубликованные", async () => {
    const all = [ids.publicComplex, ids.draftComplex, ids.hiddenComplex, ids.orphanComplex];
    const forSite = await blockRows(anon, all);
    expect(new Set(forSite.map((row) => row.complex_id))).toEqual(new Set([ids.publicComplex]));
    const forStaff = await blockRows(user(videographer), all);
    expect(forStaff.map((row) => row.block_id)).toContain(ids.draftBlock);
  });

  it("блок без списка, где все планировки «нет в наличии», — не «по планировкам»", async () => {
    await db.admin.query("update layouts set available = false where block_id = $1", [manualBlock]);
    const manual = (await blockRows(anon, [ids.publicComplex])).find(
      (row) => row.block_id === manualBlock,
    );
    expect(manual).toMatchObject({ free_count: null, available: false });
    await db.admin.query("update layouts set available = true where block_id = $1 and rooms = 1", [
      manualBlock,
    ]);
  });

  it("квартиры блока: три статуса, цена только у свободных, без полей сотрудников", async () => {
    const units = await call<Record<string, unknown>>(anon, "select * from block_units($1)", [
      ids.publicBlock,
    ]);
    expect(units.map((row) => [row.number, row.status, row.price])).toEqual([
      ["1", "free", "30000.00"],
      ["2", "free", "31000.00"],
      ["3", "reserved", null],
      ["4", "sold", null],
    ]);
    expect(Object.keys(units[0]!)).not.toContain("updated_by");
    expect(Object.keys(units[0]!)).not.toContain("updated_at");

    const generated = await call<{ unit_id: string; rooms: number | null }>(
      anon,
      "select unit_id, rooms from block_units($1)",
      [generatedBlock],
    );
    expect(generated.find((row) => row.unit_id === unassignedUnit)?.rooms).toBeNull();
  });

  it("черновик: сайту пусто, сотрудникам видно (предпросмотр)", async () => {
    expect(await layouts(anon, ids.draftComplex)).toEqual([]);
    expect(await rooms(anon, [ids.draftComplex, ids.hiddenComplex, ids.orphanComplex])).toEqual([]);
    expect(await call(anon, "select * from block_units($1)", [ids.draftBlock])).toEqual([]);
    await db.admin.query("insert into layouts (block_id, rooms, area) values ($1, 2, 60)", [
      ids.draftBlock,
    ]);
    expect(await layouts(user(videographer), ids.draftComplex)).toHaveLength(1);
  });

  it("смена статуса сразу меняет «осталось N»", async () => {
    const before = (await layouts(anon, ids.publicComplex)).find(
      (row) => row.layout_id === ids.oneRoomLayout,
    );
    await db.admin.query("update units set status = 'sold' where id = $1", [ids.units[0]]);
    const after = (await layouts(anon, ids.publicComplex)).find(
      (row) => row.layout_id === ids.oneRoomLayout,
    );
    expect(after?.free_count).toBe((before?.free_count ?? 0) - 1);
    expect(after?.price_from).toBe("31000.00");
  });

  it("квартира не может ссылаться на планировку чужого блока", async () => {
    await expect(
      db.admin.query(
        "insert into units (block_id, layout_id, entrance, floor, position, number) values ($1, $2, 9, 9, 9, '999')",
        [generatedBlock, ids.oneRoomLayout],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("таблица квартир посетителю по-прежнему закрыта", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select id from units")));
  });
});

/**
 * Блок B, как после генератора: 3 подъезда × этажи 2–16 × 4 квартиры = 180 квартир.
 * Статусы и цены — по формуле, чтобы подсчёт был воспроизводимым; плюс квартира без планировки.
 */
async function seedGeneratedBlock(db: TestDb, complexId: string) {
  const { rows } = await db.admin.query<{ id: string }>(
    "insert into blocks (complex_id, name, floors_total, sort) values ($1, 'B', 16, 1) returning id",
    [complexId],
  );
  const block = rows[0]!.id;
  const layoutIds: string[] = [];
  for (const [rooms, area, priceFrom] of [
    [1, 41, null],
    [2, 58, null],
    [2, 61.5, null],
    [3, 78, 70000],
  ] as const) {
    const created = await db.admin.query<{ id: string }>(
      "insert into layouts (block_id, rooms, area, price_from) values ($1, $2, $3, $4) returning id",
      [block, rooms, area, priceFrom],
    );
    layoutIds.push(created.rows[0]!.id);
  }
  // Номер n = (подъезд − 1) × 60 + (этаж − 2) × 4 + позиция. Цена: n % 3 = 0 — целиком,
  // 1 — за м², 2 — нет; у 3-комн. цен нет вовсе. Статус: n % 5 = 3 — бронь, 4 — продана.
  await db.admin.query(
    `insert into units (block_id, layout_id, entrance, floor, position, number, price, price_per_m2, status)
     select $1, ($2::uuid[])[p], e, f, p, n::text,
            case when p <> 4 and n % 3 = 0 then 30000 + n * 100 end,
            case when p <> 4 and n % 3 = 1 then 600 + n end,
            (case n % 5 when 3 then 'reserved' when 4 then 'sold' else 'free' end)::unit_status
     from generate_series(1, 3) e, generate_series(2, 16) f, generate_series(1, 4) p,
          lateral (select (e - 1) * 60 + (f - 2) * 4 + p as n) num`,
    [block, layoutIds],
  );
  const unassigned = await db.admin.query<{ id: string }>(
    "insert into units (block_id, entrance, floor, position, number) values ($1, 1, 1, 1, 'К1') returning id",
    [block],
  );
  return { generatedBlock: block, unassignedUnit: unassigned.rows[0]!.id };
}

/** Блок C без списка квартир, цены в сумах: 1-комн. доступна, 4-комн. — нет. */
async function seedManualBlock(db: TestDb, complexId: string) {
  const { rows } = await db.admin.query<{ id: string }>(
    "insert into blocks (complex_id, name, currency, sort) values ($1, 'C', 'UZS', 2) returning id",
    [complexId],
  );
  const block = rows[0]!.id;
  await db.admin.query(
    `insert into layouts (block_id, rooms, area, price_from, available) values
       ($1, 1, 40, 350000000, true),
       ($1, 4, 120, 900000000, false)`,
    [block],
  );
  return block;
}
