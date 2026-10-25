import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, isRemoteTarget, service, user, type TestDb } from "./harness";

// Шаг 3.13: архив (миграция 20261026140000_archive_purge.sql) на DEMO-сиде, с подменой даты
// архивации: напоминание за 3 дня — один раз, удаление через 30 дней — только всё ещё архивного,
// CSV-строки квартир, адрес: в архиве — 307, удалён — 308. Всё, кроме проверки адреса, — только сервер.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Item = { kind: string; id: string; slug: string; media: string[]; complexes: string[] };

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
    const reminders = await call<Item[]>("select take_archive_reminders() as v");
    expect(reminders.map((item) => item.slug)).toEqual([complex.slug]);
    expect(await call<Item[]>("select take_archive_reminders() as v")).toEqual([]);
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
});
