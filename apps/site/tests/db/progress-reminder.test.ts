import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  service,
  user,
  type TestDb,
} from "./harness";

// Фаза 5 (5D.3): напоминание о ходе строительства (миграция 20261029150000_progress_reminder.sql) —
// кому пора (строится блок, последний опубликованный отчёт блока старше 45 дней или его нет), отметка
// перед отправкой не чаще раза в 7 дней, снятие отметки при сбое; только серверу.

type Due = { id: string; name: string; last_published_at: string | null };
type Claim = { at: string; ids: string[] };

describe("напоминание о ходе строительства", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;

  const due = async () =>
    (await db.as(service, (tx) => tx.query<{ r: Due[] }>("select progress_reminders_due() as r")))
      .rows[0]!.r;
  const claim = async (complexes: string[]) =>
    (
      await db.as(service, (tx) =>
        tx.query<{ r: Claim }>("select claim_progress_reminders($1::uuid[]) as r", [complexes]),
      )
    ).rows[0]!.r;
  const release = (complexes: string[], at: string) =>
    db.as(service, (tx) =>
      tx.query("select release_progress_reminders($1::uuid[], $2::timestamptz)", [complexes, at]),
    );
  /** Опубликованный отчёт блока ЖК — published_at столько дней назад (снимок без проверок RPC). */
  const published = async (daysAgo: number) => {
    await db.admin.query("select set_config('vodiy.skip_audit', 'on', false)");
    await db.admin.query(
      `insert into progress_reports (complex_id, block_id, author_id, month, status, comment, published_at, published_by)
       values ($1, $2, $3, date_trunc('month', now() - make_interval(days => $4))::date, 'published',
               '{"ru":"Ход","uz":"Ход"}', now() - make_interval(days => $4), $3)`,
      [ids.publicComplex, ids.publicBlock, head, daysAgo],
    );
  };

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
  });
  afterAll(() => db.close());

  it("строящийся ЖК без отчётов — пора; один раз за 7 дней; сбой отправки снимает отметку", async () => {
    const first = await due();
    expect(first.find((item) => item.id === ids.publicComplex)).toMatchObject({
      last_published_at: null,
    });

    const claimed = await claim([ids.publicComplex]);
    expect(claimed.ids).toEqual([ids.publicComplex]);
    expect((await due()).map((item) => item.id)).not.toContain(ids.publicComplex);
    // Второй запуск задачи в тот же день — уже отмечено, отправлять нечего.
    expect((await claim([ids.publicComplex])).ids).toEqual([]);

    await release([ids.publicComplex], claimed.at);
    expect((await due()).map((item) => item.id)).toContain(ids.publicComplex);

    // Отметка старше 7 дней — напоминание повторяется.
    await claim([ids.publicComplex]);
    await db.admin.query("update progress_notices set reminded_at = now() - interval '8 days'");
    expect((await due()).map((item) => item.id)).toContain(ids.publicComplex);
    expect((await claim([ids.publicComplex])).ids).toEqual([ids.publicComplex]);
    await db.admin.query("delete from progress_notices");
  });

  it("отчёт 46 дней назад — пора, 10 дней назад — нет; сданный ЖК — нет", async () => {
    await published(46);
    expect(
      (await due()).find((item) => item.id === ids.publicComplex)?.last_published_at,
    ).toBeTruthy();
    await published(10);
    expect((await due()).map((item) => item.id)).not.toContain(ids.publicComplex);

    await db.admin.query("delete from progress_reports");
    await db.admin.query("update blocks set build_status = 'delivered' where complex_id = $1", [
      ids.publicComplex,
    ]);
    expect((await due()).map((item) => item.id)).not.toContain(ids.publicComplex);
    await db.admin.query("update blocks set build_status = 'building' where complex_id = $1", [
      ids.publicComplex,
    ]);
  });

  it("только серверу: сотрудник и посетитель не вызывают, таблицу отметок не читают", async () => {
    for (const actor of [anon, user(head)]) {
      await expectDenied(db.as(actor, (tx) => tx.query("select progress_reminders_due()")));
      await expectDenied(
        db.as(actor, (tx) => tx.query("select claim_progress_reminders('{}'::uuid[])")),
      );
      await expectDenied(
        db.as(actor, (tx) => tx.query("select release_progress_reminders('{}'::uuid[], now())")),
      );
      await expectDenied(db.as(actor, (tx) => tx.query("select * from progress_notices")));
    }
  });
});
