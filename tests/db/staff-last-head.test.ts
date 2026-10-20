import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStaff, createTestDb, expectHint, service, user, type TestDb } from "./harness";

// Кабинет не остаётся без руководителя (шаг 8): триггер profiles_keep_active_head.
// Тесты идут по порядку и меняют состояние — оно расписано в названиях.
describe("хотя бы один активный руководитель", () => {
  let db: TestDb;
  let headA: string;
  let headB: string;

  beforeAll(async () => {
    db = await createTestDb();
    headA = await createStaff(db.admin, "head", { fullName: "Руководитель А" });
  });
  afterAll(() => db.close());

  const activeHeads = async () =>
    (
      await db.admin.query<{ id: string }>("select id from profiles where role = 'head' and is_active order by id")
    ).rows.map((row) => row.id);

  it("единственного активного руководителя сервер не отключает и не разжалует", async () => {
    await expectHint(
      db.as(service, (tx) => tx.query("update profiles set is_active = false where id = $1", [headA])),
      "vh:last_head",
    );
    await expectHint(
      db.as(service, (tx) => tx.query("update profiles set role = 'manager' where id = $1", [headA])),
      "vh:last_head",
    );
  });

  it("себя разжаловать — прежняя ошибка vh:self (защита своего профиля срабатывает раньше)", async () => {
    await expectHint(
      db.as(user(headA), (tx) => tx.query("update profiles set role = 'manager' where id = $1", [headA])),
      "vh:self",
    );
  });

  it("двое: А отключает Б — можно; затем сервер не отключает А", async () => {
    headB = await createStaff(db.admin, "head", { fullName: "Руководитель Б" });
    await db.as(user(headA), (tx) => tx.query("update profiles set is_active = false where id = $1", [headB]));
    expect(await activeHeads()).toEqual([headA]);
    await expectHint(
      db.as(service, (tx) => tx.query("update profiles set is_active = false where id = $1", [headA])),
      "vh:last_head",
    );
  });

  it("отключённого руководителя можно разжаловать", async () => {
    const result = await db.as(user(headA), (tx) =>
      tx.query("update profiles set role = 'manager' where id = $1", [headB]),
    );
    expect(result.affectedRows).toBe(1);
  });

  it("сервер одним запросом не отключает всех руководителей — отказ, ничего не меняется", async () => {
    const headC = await createStaff(db.admin, "head");
    const headD = await createStaff(db.admin, "head");
    await expectHint(
      db.as(service, (tx) => tx.query("update profiles set is_active = false where role = 'head'")),
      "vh:last_head",
    );
    expect(await activeHeads()).toEqual([headA, headC, headD].sort());
  });

  it("А одним запросом отключает всех руководителей, кроме себя", async () => {
    const result = await db.as(user(headA), (tx) =>
      tx.query("update profiles set is_active = false where role = 'head' and id <> $1", [headA]),
    );
    expect(result.affectedRows).toBe(2);
    expect(await activeHeads()).toEqual([headA]);
  });
});
