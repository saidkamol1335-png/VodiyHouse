import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createTestDb, migrationFiles, service, user, type TestDb } from "./harness";

describe("стенд базы", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(() => db.close());

  it("применяет все миграции по порядку", async () => {
    const files = await migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    expect([...files].sort()).toEqual(files);
  });

  it("роль и claims видны так же, как в облаке", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    const asUser = await db.as(user(id), (tx) =>
      tx.query<{ uid: string; role: string; pg: string }>(
        "select auth.uid() as uid, auth.role() as role, current_user as pg",
      ),
    );
    expect(asUser.rows[0]).toEqual({ uid: id, role: "authenticated", pg: "authenticated" });

    const asAnon = await db.as(anon, (tx) =>
      tx.query<{ uid: string | null }>("select auth.uid() as uid"),
    );
    expect(asAnon.rows[0]?.uid).toBeNull();

    const asService = await db.as(service, (tx) =>
      tx.query<{ pg: string }>("select current_user as pg"),
    );
    expect(asService.rows[0]?.pg).toBe("service_role");
  });

  it("после транзакции роль возвращается к суперпользователю", async () => {
    await db.as(anon, (tx) => tx.query("select 1"));
    const { rows } = await db.admin.query<{ pg: string }>("select current_user as pg");
    expect(rows[0]?.pg).toBe("postgres");
  });
});
