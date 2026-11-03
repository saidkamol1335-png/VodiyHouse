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

  // Проект-2, фаза B: справочники сайт берёт готовыми из функций site_*; таблицы посетителю закрыты.
  it("посетитель таблицу справочника не читает; скрытые строки видят только сотрудники", async () => {
    await db.admin.query("update locations set is_active = false where slug = 'kuvasay'");
    const visibleTo = async (id: string | null) => {
      const actor = id ? user(id) : anon;
      const { rows } = await db.as(actor, (tx) =>
        tx.query<{ slug: string }>("select slug from locations"),
      );
      return rows.map((row) => row.slug);
    };
    await expectDenied(visibleTo(null));
    expect(await visibleTo(manager)).toContain("kuvasay");
    expect(await visibleTo(manager)).toHaveLength(19);
    await db.admin.query("update locations set is_active = true where slug = 'kuvasay'");
  });

  // Фаза D (PLAN §10, п. 29): менеджер добавляет пункты справочников заполнения ЖК; правит — руководитель.
  it("добавляют руководитель и менеджер, правит только руководитель", async () => {
    const insert = `insert into finishings (slug, name) values ($1, '{"ru": "Тест", "uz": "Test"}')`;
    await expectDenied(db.as(anon, (tx) => tx.query(insert, ["anon-try"])));
    await db.as(user(manager), (tx) => tx.query(insert, ["manager-ok"]));
    expect(await count("select count(*) as n from finishings where slug = 'manager-ok'")).toBe(1);
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
  let mobilographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
    await db.admin.exec(`
      insert into settings (key, value, is_public) values
        ('contacts.phone', '"TODO-заказчик"', true),
        ('leads.telegram_chat', '"секрет"', false);
      -- Облачный прогон (remote.ts) чистит settings целиком — строку миграции 20261102160000 кладём сами.
      insert into settings (key, value, is_public) values ('leads.channels', '["telegram", "sheet"]', false)
        on conflict (key) do nothing;
    `);
  });
  afterAll(() => db.close());

  // Сайт (anon) читает публичные настройки представлением public_settings (Проект-2, фаза B).
  const keysFor = async (id: string | null) => {
    const source = id ? "settings" : "public_settings";
    const { rows } = await db.as(id ? user(id) : anon, (tx) =>
      tx.query<{ key: string }>(`select key from ${source} order by key`),
    );
    return rows.map((row) => row.key);
  };

  it("сайт видит только публичные настройки, мобилограф — тоже", async () => {
    expect(await keysFor(null)).toEqual(["contacts.phone"]);
    expect(await keysFor(mobilographer)).toEqual(["contacts.phone"]);
  });

  it("руководитель и менеджер видят все настройки", async () => {
    // leads.channels — каналы доставки заявок по умолчанию (20261102160000).
    const all = ["contacts.phone", "leads.channels", "leads.telegram_chat"];
    expect(await keysFor(manager)).toEqual(all);
    expect(await keysFor(head)).toEqual(all);
  });

  it("правит только руководитель", async () => {
    const update = `update settings set value = '"новое"' where key = 'contacts.phone'`;
    expect((await db.as(user(manager), (tx) => tx.query(update))).affectedRows).toBe(0);
    expect((await db.as(user(head), (tx) => tx.query(update))).affectedRows).toBe(1);
  });
});
