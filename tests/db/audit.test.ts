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

type AuditRow = {
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string;
  changes: Record<string, unknown>;
};

// Журнал изменений — ТЗ 13.1, PLAN 3а: каждое действие пишется, журнал только дописывается.
describe("журнал изменений", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
  });
  afterAll(() => db.close());

  const entries = async (entity: string) =>
    (
      await db.admin.query<AuditRow>(
        "select actor_id, action, entity, entity_id, changes from audit_log where entity = $1 order by id",
        [entity],
      )
    ).rows;

  it("начальные данные миграции в журнал не попадают", async () => {
    expect(await entries("locations")).toEqual([]);
  });

  it("добавление, правка и удаление записываются с автором и изменёнными полями", async () => {
    await db.as(user(head), (tx) =>
      tx.query(
        `insert into hints (slug, term, text) values ('cadastre', '{"ru": "Кадастр", "uz": "Kadastr"}', '{"ru": "Учёт", "uz": "Hisob"}')`,
      ),
    );
    await db.as(user(head), (tx) =>
      tx.query(
        `update hints set text = '{"ru": "Госучёт", "uz": "Hisob"}' where slug = 'cadastre'`,
      ),
    );
    await db.as(user(head), (tx) => tx.query("delete from hints where slug = 'cadastre'"));

    const log = await entries("hints");
    expect(log.map((row) => row.action)).toEqual(["insert", "update", "delete"]);
    expect(log.every((row) => row.actor_id === head)).toBe(true);
    expect(log[0]?.changes).toMatchObject({ slug: "cadastre" });
    expect(log[1]?.changes).toEqual({
      text: [
        { ru: "Учёт", uz: "Hisob" },
        { ru: "Госучёт", uz: "Hisob" },
      ],
    });
  });

  it("сохранение без изменений не засоряет журнал", async () => {
    const before = (await entries("locations")).length;
    await db.as(user(head), (tx) =>
      tx.query("update locations set sort = sort where slug = 'fergana'"),
    );
    expect(await entries("locations")).toHaveLength(before);
  });

  it("действие сервера записывается без автора", async () => {
    await db.as(service, (tx) => tx.query("update locations set sort = 11 where slug = 'fergana'"));
    const last = (await entries("locations")).at(-1);
    expect(last).toMatchObject({ actor_id: null, action: "update", changes: { sort: [10, 11] } });
  });

  it("читают руководитель и менеджер; видеограф ничего не видит, посетителю закрыто", async () => {
    const visible = async (id: string) =>
      (await db.as(user(id), (tx) => tx.query("select id from audit_log"))).rows.length;
    expect(await visible(head)).toBeGreaterThan(0);
    expect(await visible(manager)).toBe(await visible(head));
    expect(await visible(videographer)).toBe(0);
    await expectDenied(db.as(anon, (tx) => tx.query("select id from audit_log")));
  });

  it("журнал нельзя дописать вручную, править или чистить — даже руководителю", async () => {
    await expectDenied(
      db.as(user(head), (tx) =>
        tx.query(
          `insert into audit_log (action, entity, entity_id, changes) values ('update', 'x', '1', '{}')`,
        ),
      ),
    );
    await expectDenied(db.as(user(head), (tx) => tx.query("update audit_log set entity = 'x'")));
    await expectDenied(db.as(user(head), (tx) => tx.query("delete from audit_log")));
  });
});
