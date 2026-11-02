import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, service, user, type TestDb } from "./harness";

// Проверка безопасности 29.10 (миграция 20261029060000_login_failures.sql): 10 попыток входа за
// 15 минут с одним ключом (email + адрес) закрывают вход; верный пароль стирает попытки; только сервер.

const keyOf = (n: number) => n.toString(16).padStart(64, "0");

describe("лимит попыток входа", () => {
  let db: TestDb;
  const begin = async (key: string) =>
    db.as(service, async (tx) => (await tx.query<{ v: boolean }>("select public.begin_login_attempt($1) as v", [key])).rows[0]!.v);
  const clear = (key: string) => db.as(service, (tx) => tx.query("select public.clear_login_attempts($1)", [key]));

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(() => db.close());

  it("10 попыток проходят, 11-я — нет и не записывается; другой ключ не затронут", async () => {
    const key = keyOf(1);
    for (let i = 0; i < 10; i += 1) expect(await begin(key)).toBe(true);
    expect(await begin(key)).toBe(false);
    const { rows } = await db.admin.query<{ n: number }>(
      "select count(*)::int as n from public.login_failures where attempt_key = $1",
      [key],
    );
    expect(rows[0]?.n).toBe(10);
    expect(await begin(keyOf(2))).toBe(true);
  });

  it("верный пароль стирает попытки этого ключа", async () => {
    const key = keyOf(3);
    for (let i = 0; i < 10; i += 1) await begin(key);
    await clear(key);
    expect(await begin(key)).toBe(true);
  });

  it("попытки старше 15 минут не считаются, старше суток — удаляются", async () => {
    const key = keyOf(4);
    await db.admin.query(
      `insert into public.login_failures (attempt_key, created_at)
       select $1, now() - interval '20 minutes' from generate_series(1, 10)`,
      [key],
    );
    await db.admin.query("insert into public.login_failures (attempt_key, created_at) values ($1, now() - interval '2 days')", [key]);
    expect(await begin(key)).toBe(true);
    const { rows } = await db.admin.query<{ n: number }>(
      "select count(*)::int as n from public.login_failures where created_at < now() - interval '1 day'",
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("ключ — только 64 hex-знака", async () => {
    await expect(begin("не-хэш")).rejects.toThrow(/check/);
  });

  it("посетитель и сотрудник не читают таблицу и не вызывают функции", async () => {
    const head = await createStaff(db.admin, "head");
    for (const actor of [anon, user(head)]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select * from public.login_failures")));
      await expectDenied(db.as(actor, (tx) => tx.query("select public.begin_login_attempt($1)", [keyOf(6)])));
      await expectDenied(db.as(actor, (tx) => tx.query("select public.clear_login_attempts($1)", [keyOf(6)])));
    }
  });
});
