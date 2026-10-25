import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, expectHint, isRemoteTarget, service, user, type TestDb } from "./harness";

// Шаг 3.12: события сайта (миграции 20261026130000_events.sql, 20261026150000_events_fixes.sql) —
// пишет только сервер, пачкой не больше 20, 600 в час с посетителя и 3000 с адреса; подписи — только
// известные значения; «Сейчас на сайте» — руководитель и менеджер; очистка 400 дней.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

describe.skipIf(isRemoteTarget)("события сайта", () => {
  let db: TestDb;
  let complex: string;
  const track = (visitor: string, events: unknown[], source: string | null = "instagram", clientKey: string | null = null) =>
    db.as(service, async (tx) =>
      (await tx.query<{ v: number }>("select track_events($1, $2, $5, 'mobile', 'ru', $3, $4::jsonb) as v", [
        visitor,
        crypto.randomUUID(),
        source,
        JSON.stringify(events),
        clientKey,
      ])).rows[0]!.v,
    );

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
    complex = (await db.admin.query<{ id: string }>("select id from complexes where status = 'published' limit 1")).rows[0]!.id;
  });
  afterAll(() => db.close());

  it("посетитель и сотрудник не пишут и не читают события напрямую", async () => {
    const manager = await createStaff(db.admin, "manager");
    const call = "select track_events(gen_random_uuid(), gen_random_uuid(), null, 'mobile', 'ru', null, '[]'::jsonb)";
    for (const actor of [anon, user(manager)]) {
      await expectDenied(db.as(actor, (tx) => tx.query(call)));
      await expectDenied(db.as(actor, (tx) => tx.query("select * from events")));
    }
  });

  it("пачка: свои типы пишутся, чужие и битые пропускаются; не больше 20 за вызов", async () => {
    const visitor = crypto.randomUUID();
    const written = await track(visitor, [
      { type: "complex_view", path: "/ru/novostroyki/demo", entity_type: "complex", entity_id: complex },
      { type: "phone_click", entity_type: "complex", entity_id: "не-uuid" },
      { type: "hack" },
      "строка",
    ]);
    expect(written).toBe(2);
    const rows = await db.admin.query("select type, entity_id, source from events where visitor_id = $1 order by id", [visitor]);
    expect(rows.rows).toEqual([
      { type: "complex_view", entity_id: complex, source: "instagram" },
      { type: "phone_click", entity_id: null, source: "instagram" },
    ]);
    expect(await track(crypto.randomUUID(), Array.from({ length: 30 }, () => ({ type: "page_view" })))).toBe(20);
  });

  it("600 событий в час с посетителя — дальше молча ничего", async () => {
    const visitor = crypto.randomUUID();
    await db.admin.query(
      `insert into events (visitor_id, session_id, type, device, lang)
       select $1, gen_random_uuid(), 'page_view', 'mobile', 'ru' from generate_series(1, 600)`,
      [visitor],
    );
    expect(await track(visitor, [{ type: "page_view" }])).toBe(0);
  });

  it("3000 в час с адреса — без cookie (новый посетитель на каждую пачку) лимит не обойти", async () => {
    const key = "ip-hash-e2e";
    await db.admin.query("insert into event_rates (client_key, hour, count) values ($1, date_trunc('hour', now()), 2995)", [key]);
    expect(await track(crypto.randomUUID(), Array.from({ length: 10 }, () => ({ type: "page_view" })), null, key)).toBe(10);
    expect(await track(crypto.randomUUID(), [{ type: "page_view" }], null, key)).toBe(0);
  });

  it("подпись и источник — только известные значения: свободный текст в ленту не попадает", async () => {
    const visitor = crypto.randomUUID();
    const slug = (await db.admin.query<{ slug: string }>("select slug from complexes where id = $1", [complex])).rows[0]!.slug;
    await track(visitor, [
      { type: "phone_click", detail: "Срочно перезвоните +998901234567" },
      { type: "share", detail: "telegram" },
      { type: "share", detail: "звоните" },
      { type: "lead_sent", detail: "view" },
      { type: "favorite", detail: slug },
      { type: "filter", detail: "любой текст", path: "/ru/novostroyki?komnat=2" },
    ], "Отдел продаж");
    const rows = await db.admin.query<{ type: string; detail: string | null; source: string | null }>(
      "select type, detail, source from events where visitor_id = $1 order by id",
      [visitor],
    );
    expect(rows.rows.map((row) => row.detail)).toEqual([null, "telegram", null, "view", slug, null]);
    expect(rows.rows.every((row) => row.source === null)).toBe(true);
    const manager = await createStaff(db.admin, "manager");
    const feed = await db.as(user(manager), async (tx) =>
      (await tx.query<{ v: { feed: { type: string; detail: string | null; path: string | null; complex: { ru: string } | null }[] } }>("select site_now() as v")).rows[0]!.v.feed,
    );
    expect(feed.find((item) => item.type === "favorite")).toMatchObject({ detail: null });
    expect(feed.find((item) => item.type === "favorite")!.complex?.ru).toBeTruthy();
    expect(feed.find((item) => item.type === "filter")).toMatchObject({ detail: null, path: "/ru/novostroyki?komnat=2" });
  });

  it("«Сейчас на сайте»: онлайн за 5 минут, лента без просмотров страниц с названием ЖК; видеографу — нет", async () => {
    const visitor = crypto.randomUUID();
    await track(visitor, [
      { type: "page_view", path: "/ru" },
      { type: "favorite", entity_type: "complex", entity_id: complex },
    ]);
    const manager = await createStaff(db.admin, "manager");
    const now = await db.as(user(manager), async (tx) =>
      (await tx.query<{ v: { online: number; feed: { type: string; complex: { ru: string } | null; source: string }[] } }>(
        "select site_now() as v",
      )).rows[0]!.v,
    );
    expect(now.online).toBeGreaterThanOrEqual(1);
    expect(now.feed[0]).toMatchObject({ type: "favorite", source: "instagram" });
    expect(now.feed[0]!.complex?.ru).toBeTruthy();
    expect(now.feed.some((item) => item.type === "page_view")).toBe(false);
    const videographer = await createStaff(db.admin, "videographer");
    await expectHint(db.as(user(videographer), (tx) => tx.query("select site_now()")), "vh:forbidden");
  });

  it("очистка: старше 400 дней — удаляются", async () => {
    const visitor = crypto.randomUUID();
    await track(visitor, [{ type: "page_view" }, { type: "share", detail: "telegram" }]);
    await db.admin.query("update events set at = now() - interval '401 days' where visitor_id = $1 and type = 'page_view'", [visitor]);
    await db.as(service, (tx) => tx.query("select cleanup_events()"));
    const left = await db.admin.query<{ type: string }>("select type from events where visitor_id = $1", [visitor]);
    expect(left.rows.map((row) => row.type)).toEqual(["share"]);
  });
});
