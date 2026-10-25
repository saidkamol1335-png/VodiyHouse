import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, expectHint, isRemoteTarget, service, user, type TestDb } from "./harness";

// Шаг 3.8: коды «Написать в Telegram» (миграция 20261026100000_tg_starts.sql) — только сервер; код
// привязывается к одному чату; контекст чата — последний /start без заявки; очистка по срокам.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

describe.skipIf(isRemoteTarget)("коды «Написать в Telegram»", () => {
  let db: TestDb;
  const call = <T>(sql: string, params: unknown[] = []) =>
    db.as(service, async (tx) => (await tx.query<{ v: T }>(sql, params)).rows[0]!.v);
  const create = (start: Record<string, unknown>, key: string | null = null) =>
    call<string>("select create_tg_start($1::jsonb, $2) as v", [JSON.stringify({ site_lang: "ru", ...start }), key]);

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("посетитель и сотрудник кодов не создают и не читают", async () => {
    const manager = await createStaff(db.admin, "manager");
    for (const actor of [anon, user(manager)]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select create_tg_start('{}'::jsonb, null)")));
      await expectDenied(db.as(actor, (tx) => tx.query("select * from tg_starts")));
    }
  });

  it("код — 22 знака base64url; /start привязывает к чату, ЖК — в приветствии; чужой чат — нет", async () => {
    const slug = (await db.admin.query<{ slug: string }>("select slug from complexes where status = 'published' limit 1")).rows[0]!.slug;
    const code = await create({ object: { complex: slug }, page_url: "/ru/novostroyki", source: { utm_source: "instagram" } });
    expect(code).toMatch(/^[A-Za-z0-9_-]{22}$/);
    const bound = await call<{ site_lang: string; complex: { ru: string } }>("select bind_tg_start($1, 101) as v", [code]);
    expect(bound.site_lang).toBe("ru");
    expect(bound.complex.ru).toBeTruthy();
    expect(await call("select bind_tg_start($1, 101) as v", [code])).not.toBeNull();
    expect(await call("select bind_tg_start($1, 202) as v", [code])).toBeNull();
    expect(await call("select bind_tg_start('нет-такого-кода', 101) as v")).toBeNull();
    const start = await call<{ code: string; source: object }>("select tg_start_for_chat(101) as v");
    expect(start).toMatchObject({ code, source: { utm_source: "instagram" } });
    expect(start).not.toHaveProperty("client_key");
  });

  it("после заявки код не повторяется; с одного адреса — 30 кодов за 10 минут", async () => {
    const code = await create({});
    await call("select bind_tg_start($1, 303) as v", [code]);
    const lead = await call<{ id: string }>(
      "select submit_lead($1::jsonb, '{}'::lead_channel[], null) as v",
      [JSON.stringify({ type: "tg", name: "Бот", phone: "+998901110000", site_lang: "ru" })],
    );
    await call("select finish_tg_start($1, $2) as v", [code, lead.id]);
    expect(await call("select tg_start_for_chat(303) as v")).toBeNull();
    const key = `key-${crypto.randomUUID()}`;
    for (let i = 0; i < 30; i++) await create({}, key);
    await expectHint(create({}, key), "vh:rate_limited");
  });

  it("очистка: не открытые — через 7 дней (столько их принимает /start), открытые — через 30", async () => {
    const fresh = await create({});
    const late = await create({});
    const unopened = await create({});
    const opened = await create({});
    await call("select bind_tg_start($1, 404) as v", [opened]);
    await db.admin.query("update tg_starts set created_at = now() - interval '3 days' where code = $1", [late]);
    await db.admin.query("update tg_starts set created_at = now() - interval '8 days' where code = any($1)", [[unopened, opened]]);
    await call("select cleanup_tg_starts() as v");
    const left = (await db.admin.query<{ code: string }>("select code from tg_starts where code = any($1)", [[fresh, late, unopened, opened]])).rows;
    expect(left.map((row) => row.code).sort()).toEqual([fresh, late, opened].sort());
    expect(await call("select bind_tg_start($1, 405) as v", [late])).not.toBeNull();
  });

  it("обновление Telegram — один раз: повтор вебхука не обрабатывается", async () => {
    expect(await call("select take_tg_update(777001) as v")).toBe(true);
    expect(await call("select take_tg_update(777001) as v")).toBe(false);
    await expectDenied(db.as(anon, (tx) => tx.query("select take_tg_update(777002)")));
  });
});
