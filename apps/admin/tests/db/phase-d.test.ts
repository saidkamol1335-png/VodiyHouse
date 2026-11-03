import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, expectHint, isRemoteTarget, service, user, type TestDb } from "./harness";

// Фаза D (миграция 20261103100000_phase_d_admin.sql, PLAN §10 пп. 24, 25, 30): «Удалить сейчас»
// архивного ЖК руководителем, напоминание о запросе старше суток, недельная сводка черновиков.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../../../supabase/demo");

type Reminder = { id: string; complex: string; kind: string; requester: string | null };
type Draft = { id: string; name: string; missing: string[] };

describe.skipIf(isRemoteTarget)("фаза D: удалить сейчас, напоминания бота", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  const call = <T>(sql: string, params: unknown[] = []) =>
    db.as(service, async (tx) => (await tx.query<{ v: T }>(sql, params)).rows[0]!.v);
  const firstComplex = async (status: string) =>
    (
      await db.admin.query<{ id: string; slug: string }>(
        "select id, slug from complexes where status = $1 order by slug limit 1",
        [status],
      )
    ).rows[0]!;
  /** В сиде черновиков нет: ЖК сида становится черновиком (менеджер просит его опубликовать). */
  const draftComplex = async () => {
    const complex = await firstComplex("published");
    await db.admin.query("update complexes set status = 'draft' where id = $1", [complex.id]);
    return complex;
  };

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  it("«Удалить сейчас»: только руководитель и только архивный ЖК; адрес — в retired_slugs, журнал — кто", async () => {
    const complex = await firstComplex("published");
    const purge = (actor: Parameters<TestDb["as"]>[0]) =>
      db.as(actor, (tx) => tx.query<{ v: { slug: string; media: string[] } }>("select purge_complex_now($1) as v", [complex.id]));
    await expectHint(purge(user(head)), "vh:status_move");
    await db.admin.query("update complexes set status = 'archived' where id = $1", [complex.id]);
    await expectDenied(purge(anon));
    await expectHint(purge(user(manager)), "vh:head_only");
    await expectHint(
      db.as(user(manager), (tx) => tx.query("select archived_complex_units($1)", [complex.id])),
      "vh:head_only",
    );
    const units = await db.as(user(head), async (tx) =>
      (await tx.query<{ v: unknown[] }>("select archived_complex_units($1) as v", [complex.id])).rows[0]!.v,
    );
    expect(Array.isArray(units)).toBe(true);
    const { rows } = await purge(user(head));
    expect(rows[0]!.v.slug).toBe(complex.slug);
    expect((await db.admin.query("select 1 from complexes where id = $1", [complex.id])).rows).toHaveLength(0);
    expect((await db.admin.query("select 1 from retired_slugs where slug = $1", [complex.slug])).rows).toHaveLength(1);
    const log = await db.admin.query<{ actor_id: string; reason: string }>(
      "select actor_id, changes ->> 'reason' as reason from audit_log where entity = 'complexes' and entity_id = $1 and action = 'delete'",
      [complex.id],
    );
    expect(log.rows).toEqual([{ actor_id: head, reason: "deleted_now" }]);
  });

  it("запрос старше суток — напоминание один раз в сутки; ответ закрывает его; сотрудник не вызывает", async () => {
    const complex = await draftComplex();
    await db.as(user(manager), (tx) => tx.query("select request_publication($1, 'publish', 'рендеры пришли')", [complex.id]));
    expect(await call<Reminder[]>("select take_publication_reminders() as v")).toEqual([]);
    await db.admin.query("update publication_requests set requested_at = now() - interval '25 hours' where complex_id = $1", [complex.id]);
    const due = await call<Reminder[]>("select take_publication_reminders() as v");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: "publish" });
    expect(await call<Reminder[]>("select take_publication_reminders() as v")).toEqual([]);
    for (const actor of [anon, user(head), user(manager)]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select take_publication_reminders()")));
      await expectDenied(db.as(actor, (tx) => tx.query("select take_drafts_digest()")));
      await expectDenied(db.as(actor, (tx) => tx.query("select * from bot_digests")));
    }
  });

  it("сводка черновиков: старше 14 дней с недостающими пунктами, раз в неделю; не ушла — снова", async () => {
    const complex = await draftComplex();
    await db.admin.query("update complexes set created_at = now() - interval '20 days' where id = $1", [complex.id]);
    const digest = await call<Draft[] | null>("select take_drafts_digest() as v");
    expect(digest?.map((item) => item.id)).toContain(complex.id);
    expect(digest?.find((item) => item.id === complex.id)?.missing.length).toBeGreaterThan(0);
    expect(await call<Draft[] | null>("select take_drafts_digest() as v")).toBeNull();
    await call("select release_drafts_digest() as v");
    expect(await call<Draft[] | null>("select take_drafts_digest() as v")).not.toBeNull();
  });
});
