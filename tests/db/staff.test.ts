import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  service,
  user,
  type TestDb,
} from "./harness";

// Права на профили сотрудников — PLAN §3.3, §5; пароль и создание — решение фазы 1, вопрос 3.
describe("сотрудники и роли", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;
  let inactive: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
    inactive = await createStaff(db.admin, "manager", { isActive: false });
  });
  afterAll(() => db.close());

  const roleOf = async (id: string) =>
    (
      await db.admin.query<{ role: string; is_active: boolean }>(
        "select role, is_active from profiles where id = $1",
        [id],
      )
    ).rows[0];

  it("посетителю профили недоступны", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select * from profiles")));
  });

  it("сотрудник видит всю команду", async () => {
    const { rows } = await db.as(user(videographer), (tx) => tx.query("select id from profiles"));
    expect(rows).toHaveLength(4);
  });

  it("отключённый сотрудник видит только себя", async () => {
    const { rows } = await db.as(user(inactive), (tx) =>
      tx.query<{ id: string }>("select id from profiles"),
    );
    expect(rows.map((row) => row.id)).toEqual([inactive]);
  });

  it("менеджер не может повысить себя", async () => {
    const result = await db.as(user(manager), (tx) =>
      tx.query("update profiles set role = 'head' where id = $1", [manager]),
    );
    expect(result.affectedRows).toBe(0);
    expect((await roleOf(manager))?.role).toBe("manager");
  });

  it("флаг смены пароля меняет только сервер", async () => {
    await expectDenied(
      db.as(user(head), (tx) =>
        tx.query("update profiles set must_change_password = false where id = $1", [head]),
      ),
    );
    await db.as(service, (tx) =>
      tx.query("update profiles set must_change_password = false where id = $1", [head]),
    );
    const { rows } = await db.admin.query<{ must_change_password: boolean }>(
      "select must_change_password from profiles where id = $1",
      [head],
    );
    expect(rows[0]?.must_change_password).toBe(false);
  });

  it("руководитель меняет роль и отключает сотрудника", async () => {
    const someone = await createStaff(db.admin, "videographer");
    await db.as(user(head), (tx) =>
      tx.query("update profiles set role = 'manager', is_active = false where id = $1", [someone]),
    );
    expect(await roleOf(someone)).toEqual({ role: "manager", is_active: false });
  });

  it("руководитель не может разжаловать или отключить себя, но меняет своё имя", async () => {
    await expect(
      db.as(user(head), (tx) =>
        tx.query("update profiles set role = 'manager' where id = $1", [head]),
      ),
    ).rejects.toThrow(/Нельзя поменять свою роль/);
    await expect(
      db.as(user(head), (tx) =>
        tx.query("update profiles set is_active = false where id = $1", [head]),
      ),
    ).rejects.toThrow(/отключить себя/);

    await db.as(user(head), (tx) =>
      tx.query("update profiles set full_name = 'Руководитель' where id = $1", [head]),
    );
    expect(await roleOf(head)).toEqual({ role: "head", is_active: true });
  });

  it("создать профиль может только сервер", async () => {
    const created = await db.admin.query<{ id: string }>(
      "insert into auth.users (email) values ('new@test.local') returning id",
    );
    const id = created.rows[0]!.id;
    const insert = "insert into profiles (id, full_name, role) values ($1, 'Новый', 'manager')";
    await expectDenied(db.as(user(head), (tx) => tx.query(insert, [id])));
    await db.as(service, (tx) => tx.query(insert, [id]));
    expect((await roleOf(id))?.role).toBe("manager");
  });

  it("новый сотрудник обязан сменить пароль при первом входе", async () => {
    const { rows } = await db.admin.query<{ must_change_password: boolean }>(
      "select must_change_password from profiles where id = $1",
      [manager],
    );
    expect(rows[0]?.must_change_password).toBe(true);
  });
});
