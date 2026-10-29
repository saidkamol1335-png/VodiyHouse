import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, expectHint, isRemoteTarget, service, user, type TestDb } from "./harness";

// Шаг 3.13: архив (миграция 20261026140000_archive_purge.sql) на DEMO-сиде, с подменой даты
// архивации: напоминание за 3 дня — один раз, удаление через 30 дней — только всё ещё архивного,
// CSV-строки квартир, адрес: в архиве — 307, удалён — 308. Всё, кроме проверки адреса, — только сервер.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Item = { kind: string; id: string; slug: string; archived_at: string; media: string[]; complexes: string[] };

describe.skipIf(isRemoteTarget)("архив: окончательное удаление", () => {
  let db: TestDb;
  const call = <T>(sql: string, params: unknown[] = []) =>
    db.as(service, async (tx) => (await tx.query<{ v: T }>(sql, params)).rows[0]!.v);
  const archiveDaysAgo = async (table: "complexes" | "developers", id: string, days: number) => {
    await db.admin.query(`update ${table} set status = 'archived' where id = $1`, [id]);
    await db.admin.query(`update ${table} set archived_at = now() - make_interval(days => $2) where id = $1`, [id, days]);
  };

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("посетитель и сотрудник не вызывают служебные функции; адрес проверяет любой", async () => {
    const head = await createStaff(db.admin, "head");
    for (const actor of [anon, user(head)]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select archive_due()")));
      await expectDenied(db.as(actor, (tx) => tx.query("select archive_reminders_due()")));
      await expectDenied(db.as(actor, (tx) => tx.query("select claim_archive_reminder('complex', gen_random_uuid(), now())")));
      await expectDenied(db.as(actor, (tx) => tx.query("select release_archive_reminder('complex', gen_random_uuid(), now())")));
      await expectDenied(db.as(actor, (tx) => tx.query("select purge_archived('complex', gen_random_uuid())")));
      await expectDenied(db.as(actor, (tx) => tx.query("select * from retired_slugs")));
    }
    const { rows } = await db.as(anon, (tx) => tx.query<{ v: string | null }>("select site_slug_state('net-takogo') as v"));
    expect(rows[0]!.v).toBeNull();
  });

  it("за 3 дня — напоминание один раз; через 30 дней — удаление с фото в списке, адрес — 307, потом 308", async () => {
    const { rows } = await db.admin.query<{ id: string; slug: string }>(
      "select c.id, c.slug from complexes c where c.status = 'published' order by c.slug limit 1",
    );
    const complex = rows[0]!;
    await archiveDaysAgo("complexes", complex.id, 28);
    const reminders = await call<Item[]>("select archive_reminders_due() as v");
    expect(reminders.map((item) => item.slug)).toEqual([complex.slug]);
    const key = [reminders[0]!.kind, reminders[0]!.id, reminders[0]!.archived_at];
    const claim = () => call<boolean>("select claim_archive_reminder($1, $2, $3) as v", key);
    // Отметка — одна: второй запуск задачи не отправит; не ушло — отметка снята, напомнит снова.
    expect(await claim()).toBe(true);
    expect(await claim()).toBe(false);
    expect(await call<Item[]>("select archive_reminders_due() as v")).toEqual([]);
    await call("select release_archive_reminder($1, $2, $3) as v", key);
    expect((await call<Item[]>("select archive_reminders_due() as v")).map((item) => item.slug)).toEqual([complex.slug]);
    expect(await claim()).toBe(true);
    expect(await call<Item[]>("select archive_reminders_due() as v")).toEqual([]);
    expect(await call<Item[]>("select archive_due() as v")).toEqual([]);
    const units = await call<{ number: string }[]>("select archive_units($1::uuid[]) as v", [[complex.id]]);
    expect(units.length).toBeGreaterThan(0);
    expect(await call<string>("select site_slug_state($1) as v", [complex.slug])).toBe("archived");

    // В DEMO-сиде фото нет (их грузит demo:seed) — одна строка файла для списка путей.
    await db.admin.query(
      "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 1600, 1200)",
      [complex.id, `complexes/${complex.id}/e2e.jpg`],
    );
    await db.admin.query("update complexes set archived_at = now() - interval '31 days' where id = $1", [complex.id]);
    const due = await call<Item[]>("select archive_due() as v");
    expect(due.find((item) => item.id === complex.id)?.media.length).toBeGreaterThan(0);
    expect(await call<boolean>("select purge_archived('complex', $1) as v", [complex.id])).toBe(true);
    expect((await db.admin.query("select 1 from complexes where id = $1", [complex.id])).rows.length).toBe(0);
    expect((await db.admin.query("select 1 from units u join blocks b on b.id = u.block_id where b.complex_id = $1", [complex.id])).rows.length).toBe(0);
    expect(await call<string>("select site_slug_state($1) as v", [complex.slug])).toBe("deleted");
    const journal = await db.admin.query("select changes ->> 'reason' as reason from audit_log where entity_id = $1 and action = 'delete'", [complex.id]);
    expect(journal.rows).toEqual([{ reason: "archive_30_days" }]);
  });

  it("восстановили до запуска — не удаляется; 29 дней — рано", async () => {
    const { rows } = await db.admin.query<{ id: string }>("select id from complexes where status = 'published' order by slug limit 1");
    const id = rows[0]!.id;
    await archiveDaysAgo("complexes", id, 29);
    expect(await call<boolean>("select purge_archived('complex', $1) as v", [id])).toBe(false);
    await db.admin.query("update complexes set status = 'hidden' where id = $1", [id]);
    expect(await call<boolean>("select purge_archived('complex', $1) as v", [id])).toBe(false);
    expect((await db.admin.query("select 1 from complexes where id = $1", [id])).rows.length).toBe(1);
  });

  it("адрес удалённого ЖК снова занят новым ЖК — больше не уводит в каталог", async () => {
    const { rows } = await db.admin.query<{ id: string; slug: string }>("select id, slug from complexes where status = 'published' order by slug desc limit 1");
    await db.admin.query("insert into retired_slugs (slug) values ($1) on conflict do nothing", [rows[0]!.slug]);
    expect(await call<string | null>("select site_slug_state($1) as v", [rows[0]!.slug])).toBeNull();
    await db.admin.query("delete from retired_slugs where slug = $1", [rows[0]!.slug]);
  });

  it("застройщика восстановили на 28-й день — у его ЖК в архиве отсчёт 30 дней заново", async () => {
    const { rows } = await db.admin.query<{ id: string }>(
      "select d.id from developers d where d.status = 'published' and exists (select 1 from complexes c where c.developer_id = d.id and c.status = 'published') order by d.slug desc limit 1",
    );
    const developer = rows[0]!.id;
    await db.admin.query("update developers set status = 'archived' where id = $1", [developer]);
    await db.admin.query("update complexes set archived_at = now() - interval '28 days' where developer_id = $1", [developer]);
    await db.admin.query("update developers set archived_at = now() - interval '28 days' where id = $1", [developer]);
    await db.admin.query("update developers set status = 'hidden' where id = $1", [developer]);
    const fresh = await db.admin.query<{ fresh: boolean }>(
      "select bool_and(archived_at > now() - interval '1 minute') as fresh from complexes where developer_id = $1 and status = 'archived'",
      [developer],
    );
    expect(fresh.rows[0]!.fresh).toBe(true);
    const due = await call<Item[]>("select archive_due() as v");
    const own = (await db.admin.query<{ id: string }>("select id from complexes where developer_id = $1", [developer])).rows.map((row) => row.id);
    expect(due.some((item) => own.includes(item.id))).toBe(false);
  });

  it("застройщик: через 30 дней — вместе со всеми ЖК; его ЖК отдельно в списке не дублируются", async () => {
    const { rows } = await db.admin.query<{ id: string }>(
      "select d.id from developers d where exists (select 1 from complexes c where c.developer_id = d.id) order by d.slug limit 1",
    );
    const developer = rows[0]!.id;
    await db.admin.query("update complexes set status = 'archived' where developer_id = $1", [developer]);
    await db.admin.query("update complexes set archived_at = now() - interval '31 days' where developer_id = $1", [developer]);
    await archiveDaysAgo("developers", developer, 31);
    const due = await call<Item[]>("select archive_due() as v");
    expect(due.filter((item) => item.kind === "developer").map((item) => item.id)).toContain(developer);
    const own = (await db.admin.query<{ id: string }>("select id from complexes where developer_id = $1", [developer])).rows.map((row) => row.id);
    expect(due.some((item) => item.kind === "complex" && own.includes(item.id))).toBe(false);
    expect(await call<boolean>("select purge_archived('developer', $1) as v", [developer])).toBe(true);
    expect((await db.admin.query("select 1 from developers where id = $1", [developer])).rows.length).toBe(0);
    expect((await db.admin.query("select 1 from complexes where developer_id = $1", [developer])).rows.length).toBe(0);
  });

  // Полировка блока F (20261029040000): адрес из retired_slugs у посетителей помнит переадресацию.
  it("адрес удалённого ЖК не занять: новый ЖК получает суффикс, правка адреса — отказ", async () => {
    const head = await createStaff(db.admin, "head");
    const { rows: developers } = await db.admin.query<{ id: string }>("select id from developers order by slug limit 1");
    await db.admin.query("insert into retired_slugs (slug) values ('byvshiy') on conflict do nothing");
    const created = await db.as(user(head), (tx) =>
      tx.query<{ id: string }>("select create_complex($1, $2, 'byvshiy') as id", [developers[0]!.id, JSON.stringify({ ru: "Бывший", uz: "Bivshiy" })]),
    );
    const slug = await db.admin.query<{ slug: string }>("select slug from complexes where id = $1", [created.rows[0]!.id]);
    expect(slug.rows[0]!.slug).toBe("byvshiy-2");
    await expectHint(
      db.as(user(head), (tx) => tx.query("update complexes set slug = 'byvshiy' where id = $1", [created.rows[0]!.id])),
      "vh:slug_retired",
    );
    // DEMO пересоздаётся одной командой — его адреса не проверяются.
    await db.admin.query("insert into retired_slugs (slug) values ('demo-byvshiy') on conflict do nothing");
    const demo = await db.admin.query<{ id: string }>(
      `insert into complexes (developer_id, slug, name) values ($1, 'demo-byvshiy', '{"ru": "Демо", "uz": "Demo"}') returning id`,
      [developers[0]!.id],
    );
    expect(demo.rows).toHaveLength(1);
  });
});
