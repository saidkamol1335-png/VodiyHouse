import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, user, type TestDb } from "./harness";

// Архив кнопок фильтра (20261106120000): запись site.filter_archive правят руководитель и менеджер,
// сайт читает её через public_settings; остальные настройки менеджеру по-прежнему закрыты.
describe("архив кнопок фильтра", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let mobilographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
    await db.admin.exec(`
      insert into settings (key, value, is_public) values ('contacts.phone', '"TODO-заказчик"', true)
        on conflict (key) do nothing;
    `);
  });
  afterAll(() => db.close());

  const upsert = (value: string, isPublic = true) =>
    `insert into settings (key, value, is_public) values ('site.filter_archive', '${value}', ${isPublic})
       on conflict (key) do update set value = excluded.value, is_public = excluded.is_public`;

  it("менеджер добавляет и правит запись архива", async () => {
    await db.as(user(manager), (tx) =>
      tx.query(upsert('{"items":[{"id":"payment:mort","at":"2026-11-06T10:00:00Z"}]}')),
    );
    await db.as(user(manager), (tx) => tx.query(upsert('{"items":[]}')));
    const { rows } = await db.admin.query<{ value: unknown }>(
      "select value from settings where key = 'site.filter_archive'",
    );
    expect(rows[0]?.value).toEqual({ items: [] });
  });

  it("менеджер не делает запись архива закрытой", async () => {
    await expectDenied(db.as(user(manager), (tx) => tx.query(upsert('{"items":[]}', false))));
  });

  it("руководитель правит запись архива", async () => {
    const update = `update settings set value = '{"items":[{"id":"rooms:0","at":"2026-11-06T10:00:00Z"}]}' where key = 'site.filter_archive'`;
    expect((await db.as(user(head), (tx) => tx.query(update))).affectedRows).toBe(1);
  });

  it("сайт читает архив через public_settings", async () => {
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ value: { items: { id: string }[] } }>(
        "select value from public_settings where key = 'site.filter_archive'",
      ),
    );
    expect(rows[0]?.value.items.map((item) => item.id)).toEqual(["rooms:0"]);
  });

  it("остальные настройки менеджер не правит, мобилограф и посетитель — архив тоже", async () => {
    const phone = `update settings set value = '"новое"' where key = 'contacts.phone'`;
    expect((await db.as(user(manager), (tx) => tx.query(phone))).affectedRows).toBe(0);
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query(`insert into settings (key, value, is_public) values ('site.other', '1', true)`),
      ),
    );
    const archive = `update settings set value = '{"items":[]}' where key = 'site.filter_archive'`;
    expect((await db.as(user(mobilographer), (tx) => tx.query(archive))).affectedRows).toBe(0);
    await expectDenied(db.as(anon, (tx) => tx.query(archive)));
  });

  it("менеджер не переименовывает запись архива и не делает её закрытой", async () => {
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query("update settings set key = 'site.other' where key = 'site.filter_archive'"),
      ),
    );
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query("update settings set is_public = false where key = 'site.filter_archive'"),
      ),
    );
  });

  it("менеджер не удаляет запись архива", async () => {
    const remove = "delete from settings where key = 'site.filter_archive'";
    expect((await db.as(user(manager), (tx) => tx.query(remove))).affectedRows).toBe(0);
  });
});
