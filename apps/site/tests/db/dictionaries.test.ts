import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, user, type TestDb } from "./harness";

// Справочники и настройки — ТЗ 12, 13.2; права — PLAN §5.
describe("справочники", () => {
  let db: TestDb;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const count = async (sql: string) =>
    Number((await db.admin.query<{ n: number }>(sql)).rows[0]?.n);

  it("начальные данные: деление области, документы, темы деталей, отделка", async () => {
    expect(await count("select count(*) as n from locations where kind = 'city'")).toBe(4);
    expect(await count("select count(*) as n from locations where kind = 'district'")).toBe(15);
    expect(await count("select count(*) as n from document_types")).toBe(6);
    expect(await count("select count(*) as n from detail_topics")).toBe(6);
    expect(await count("select count(*) as n from finishings")).toBe(4);
  });

  it("посетитель читает справочник, скрытые строки видят только сотрудники", async () => {
    await db.admin.query("update locations set is_active = false where slug = 'kuvasay'");
    const visibleTo = async (id: string | null) => {
      const actor = id ? user(id) : anon;
      const { rows } = await db.as(actor, (tx) =>
        tx.query<{ slug: string }>("select slug from locations"),
      );
      return rows.map((row) => row.slug);
    };
    expect(await visibleTo(null)).toHaveLength(18);
    expect(await visibleTo(null)).not.toContain("kuvasay");
    expect(await visibleTo(manager)).toContain("kuvasay");
    await db.admin.query("update locations set is_active = true where slug = 'kuvasay'");
  });

  it("добавляет и правит только руководитель", async () => {
    const insert = `insert into finishings (slug, name) values ($1, '{"ru": "Тест", "uz": "Test"}')`;
    await expectDenied(db.as(anon, (tx) => tx.query(insert, ["anon-try"])));
    await expectDenied(db.as(user(manager), (tx) => tx.query(insert, ["manager-try"])));
    await db.as(user(head), (tx) => tx.query(insert, ["head-ok"]));
    expect(await count("select count(*) as n from finishings where slug = 'head-ok'")).toBe(1);

    const renamed = await db.as(user(manager), (tx) =>
      tx.query(`update finishings set name = '{"ru": "x", "uz": "x"}' where slug = 'head-ok'`),
    );
    expect(renamed.affectedRows).toBe(0);
  });

  it("название обязательно на двух языках, без лишних ключей", async () => {
    const insert = (name: string) =>
      db.as(user(head), (tx) =>
        tx.query("insert into detail_topics (slug, name) values ('t', $1::jsonb)", [name]),
      );
    await expect(insert('{"ru": "Только русский"}')).rejects.toThrow(/i18n_text/);
    await expect(insert('{"ru": "Тема", "uz": "  "}')).rejects.toThrow(/i18n_text/);
    await expect(insert('{"ru": "Тема", "uz": "Mavzu", "en": "Topic"}')).rejects.toThrow(
      /i18n_text/,
    );
    await expect(insert('"просто строка"')).rejects.toThrow(/i18n_text/);
  });
});

describe("настройки", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
    await db.admin.exec(`
      insert into settings (key, value, is_public) values
        ('contacts.phone', '"TODO-заказчик"', true),
        ('leads.telegram_chat', '"секрет"', false);
    `);
  });
  afterAll(() => db.close());

  const keysFor = async (id: string | null) => {
    const { rows } = await db.as(id ? user(id) : anon, (tx) =>
      tx.query<{ key: string }>("select key from settings order by key"),
    );
    return rows.map((row) => row.key);
  };

  it("сайт видит только публичные настройки, видеограф — тоже", async () => {
    expect(await keysFor(null)).toEqual(["contacts.phone"]);
    expect(await keysFor(videographer)).toEqual(["contacts.phone"]);
  });

  it("руководитель и менеджер видят все настройки", async () => {
    expect(await keysFor(manager)).toEqual(["contacts.phone", "leads.telegram_chat"]);
    expect(await keysFor(head)).toEqual(["contacts.phone", "leads.telegram_chat"]);
  });

  it("правит только руководитель", async () => {
    const update = `update settings set value = '"новое"' where key = 'contacts.phone'`;
    expect((await db.as(user(manager), (tx) => tx.query(update))).affectedRows).toBe(0);
    expect((await db.as(user(head), (tx) => tx.query(update))).affectedRows).toBe(1);
  });
});
