import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PUBLICATION_STATUSES } from "@/lib/admin/publication";
import { makeComplexReady, seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  user,
  type Actor,
  type TestDb,
} from "./harness";

// Застройщики, ЖК, медиа — PLAN §5 и приёмка фазы 1: посетитель не читает developer_private и
// черновики; менеджер не может создать, опубликовать или архивировать ЖК.
describe("застройщики, ЖК и медиа", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let videographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
  });
  afterAll(() => db.close());

  const idsVisible = async (actor: Actor, table: string) => {
    const { rows } = await db.as(actor, (tx) =>
      tx.query<{ id: string }>(`select id from ${table}`),
    );
    return rows.map((row) => row.id);
  };

  it("сайт видит только опубликованные ЖК опубликованных застройщиков", async () => {
    expect(await idsVisible(anon, "complexes")).toEqual([ids.publicComplex]);
    expect(await idsVisible(anon, "developers")).toEqual([ids.publicDeveloper]);
  });

  it("сотрудники, включая видеографа, видят и черновики", async () => {
    for (const id of [head, manager, videographer]) {
      expect(await idsVisible(user(id), "complexes")).toHaveLength(4);
      expect(await idsVisible(user(id), "developers")).toHaveLength(2);
    }
  });

  it("внутренние контакты застройщика: сайту закрыто, видеографу пусто, менеджеру и руководителю видно", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select * from developer_private")));
    const contacts = async (id: string) =>
      (
        await db.as(user(id), (tx) =>
          tx.query<{ contacts: string }>("select contacts from developer_private"),
        )
      ).rows;
    expect(await contacts(videographer)).toEqual([]);
    expect(await contacts(manager)).toEqual([{ contacts: "+998 90 000-00-00" }]);
    expect(await contacts(head)).toHaveLength(1);
  });

  it("сданные объекты и фото видны сайту только у опубликованных", async () => {
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ name: string }>("select name ->> 'ru' as name from developer_past_projects"),
    );
    expect(rows).toEqual([{ name: "Сданный дом" }]);
    expect(await idsVisible(anon, "media_assets")).toEqual([ids.publicPhoto]);
    expect(await idsVisible(user(videographer), "media_assets")).toHaveLength(2);
  });

  it("менеджер не может создать, опубликовать или архивировать ЖК", async () => {
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query(
          `insert into complexes (developer_id, slug, name) values ($1, 'new', '{"ru": "Новый", "uz": "Yangi"}')`,
          [ids.publicDeveloper],
        ),
      ),
    );
    for (const status of ["published", "archived"]) {
      const result = await db.as(user(manager), (tx) =>
        tx.query("update complexes set status = $1 where id = $2", [status, ids.draftComplex]),
      );
      expect(result.affectedRows).toBe(0);
    }
    const draftExists = await db.admin.query<{ status: string }>(
      "select status from complexes where id = $1",
      [ids.draftComplex],
    );
    expect(draftExists.rows[0]?.status).toBe("draft");
  });

  it("руководитель создаёт, публикует, архивирует и восстанавливает ЖК; дата архива ставится сама", async () => {
    const statusOf = async (id: string) =>
      (
        await db.admin.query<{ status: string; archived: boolean }>(
          "select status, archived_at is not null as archived from complexes where id = $1",
          [id],
        )
      ).rows[0];

    const { rows } = await db.as(user(head), (tx) =>
      tx.query<{ id: string }>(
        `insert into complexes (developer_id, slug, name) values ($1, 'head-zhk', '{"ru": "Новый", "uz": "Yangi"}')
         returning id`,
        [ids.publicDeveloper],
      ),
    );
    const id = rows[0]!.id;
    expect(await statusOf(id)).toEqual({ status: "draft", archived: false });
    await makeComplexReady(db.admin, id);

    const setStatus = (status: string) =>
      db.as(user(head), (tx) =>
        tx.query("update complexes set status = $1 where id = $2", [status, id]),
      );
    // Публикация — с отметкой правила 1.2 в том же действии (шаг 11, И8).
    await db.as(user(head), (tx) =>
      tx.query("update complexes set status = 'published', files_checked_at = now() where id = $1", [id]),
    );
    expect(await idsVisible(anon, "complexes")).toContain(id);
    await setStatus("archived");
    expect(await statusOf(id)).toEqual({ status: "archived", archived: true });
    expect(await idsVisible(anon, "complexes")).not.toContain(id);
    await setStatus("draft");
    expect(await statusOf(id)).toEqual({ status: "draft", archived: false });
  });

  it("архивация застройщика архивирует все его ЖК", async () => {
    const developerId = (
      await db.admin.query<{ id: string }>(
        "insert into developers (slug, name, status) values ('to-archive', 'To Archive', 'published') returning id",
      )
    ).rows[0]!.id;
    await db.admin.query(
      `insert into complexes (developer_id, slug, name, status) values
         ($1, 'arch-1', '{"ru": "А1", "uz": "A1"}', 'published'),
         ($1, 'arch-2', '{"ru": "А2", "uz": "A2"}', 'draft')`,
      [developerId],
    );
    await db.as(user(head), (tx) =>
      tx.query("update developers set status = 'archived' where id = $1", [developerId]),
    );
    const { rows } = await db.admin.query<{ status: string; archived: boolean }>(
      "select status, archived_at is not null as archived from complexes where developer_id = $1",
      [developerId],
    );
    expect(rows).toEqual([
      { status: "archived", archived: true },
      { status: "archived", archived: true },
    ]);
  });

  it("статусы публикации в коде — как enum в базе", async () => {
    const { rows } = await db.admin.query<{ statuses: string[] }>(
      "select enum_range(null::public.publication_status)::text[] as statuses",
    );
    expect(rows[0]?.statuses).toEqual([...PUBLICATION_STATUSES]);
  });

  it("в публичных таблицах нет полей сотрудников", async () => {
    const { rows } = await db.admin.query<{ table_name: string; column_name: string }>(
      `select table_name, column_name from information_schema.column_privileges
       where grantee = 'anon' and privilege_type = 'SELECT'
         and (column_name like '%\\_by' or column_name in ('contacts', 'notes'))`,
    );
    expect(rows).toEqual([]);
  });

  it("лимиты под вёрстку и владелец медиа проверяются базой", async () => {
    await expect(
      db.admin.query(
        `insert into complexes (developer_id, slug, name)
         values ($1, 'long', '{"ru": "Очень длинное название жилого комплекса", "uz": "Qisqa"}')`,
        [ids.publicDeveloper],
      ),
    ).rejects.toThrow(/check constraint/);
    await expect(
      db.admin.query(
        "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'logo', 'x/logo.png', 600, 600)",
        [ids.publicComplex],
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
