import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { createStaff, createTestDb, expectHint, user, type TestDb } from "./harness";
import { progressKit, tashkentDates, type Dates } from "./progress-fixtures";

// Проект-2, фаза E (PLAN §10, п. 32): черновик отчёта — неполный, виден только автору, автор правит и
// удаляет; «На проверку» — полная проверка. Журнал черновика не пишет; отправка — одна запись.

describe("черновики отчётов мобилографа", () => {
  let db: TestDb;
  let ids: ContentIds;
  let dates: Dates;
  let kit: ReturnType<typeof progressKit>;
  let head: string;
  let manager: string;
  let video: string;
  let otherVideo: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    video = await createStaff(db.admin, "mobilographer");
    otherVideo = await createStaff(db.admin, "mobilographer");
    dates = await tashkentDates(db);
    kit = progressKit(db, ids, dates);
  });
  afterAll(() => db.close());

  const seen = (actor: string, id: string) =>
    db
      .as(user(actor), (tx) =>
        tx.query<{ n: string; p: string }>(
          "select (select count(*) from progress_reports where id = $1) as n, (select count(*) from progress_photos where report_id = $1) as p",
          [id],
        ),
      )
      .then((result) => ({ reports: Number(result.rows[0]!.n), photos: Number(result.rows[0]!.p) }));
  const journal = (id: string) =>
    db.admin
      .query<{ action: string; changes: Record<string, unknown> }>(
        "select action::text, changes from audit_log where entity = 'progress_reports' and entity_id = $1 order by id",
        [id],
      )
      .then((result) => result.rows);

  it("черновик: 1 фото и один язык — сохраняется; виден только автору", async () => {
    const saved = await kit.draft(
      video,
      await kit.report(video, { photos: await kit.photos(video, 1), comment: { ru: "Черновик", uz: "" } }),
    );
    expect(saved.status).toBe("draft");
    expect(await seen(video, saved.id)).toEqual({ reports: 1, photos: 1 });
    for (const actor of [otherVideo, manager, head]) expect(await seen(actor, saved.id)).toEqual({ reports: 0, photos: 0 });
    expect(await journal(saved.id)).toEqual([]);
  });

  it("черновик без фото и комментария; без блока или даты — нет", async () => {
    const empty = await kit.draft(video, await kit.report(video, { photos: [], comment: { ru: "", uz: "" }, unit_id: ids.units[0] }));
    expect(empty.status).toBe("draft");
    await expectHint(kit.draft(video, await kit.report(video, { block_id: null, photos: [] })), "vh:not_found");
    await expectHint(kit.draft(video, await kit.report(video, { shot_on: null, photos: [] })), "vh:shot_date");
    await expectHint(kit.draft(video, await kit.report(video, { shot_on: dates.d61, photos: [] })), "vh:shot_date");
    await expectHint(kit.draft(video, await kit.report(video, { photos: await kit.photos(video, 16) })), "vh:photos");
    await expectHint(kit.draft(manager, await kit.report(manager, { photos: [] })), "vh:forbidden");
  });

  it("черновики двух мобилографов на один блок — можно; второй отправленный — дубль", async () => {
    const a = await kit.draft(video, await kit.report(video));
    const b = await kit.draft(otherVideo, await kit.report(otherVideo));
    const sentB = await kit.submit(otherVideo, { ...(await kit.report(otherVideo)), id: b.id });
    expect(sentB.status).toBe("review");
    await expectHint(kit.submit(video, { ...(await kit.report(video)), id: a.id }), "vh:duplicate");
    expect(await kit.status(a.id)).toBe("draft");
  });

  it("правка и удаление своего черновика; чужой — «не найден»", async () => {
    const saved = await kit.draft(video, await kit.report(video, { unit_id: ids.units[0], photos: await kit.photos(video, 2) }));
    const [first] = await kit.storedPhotos(saved.id);
    const edited = await kit.draft(video, await kit.report(video, { id: saved.id, unit_id: ids.units[0], photos: [first!] }));
    expect(edited.removed).toHaveLength(1);
    await expectHint(kit.draft(otherVideo, await kit.report(otherVideo, { id: saved.id, unit_id: ids.units[0], photos: [] })), "vh:not_found");
    await expectHint(kit.draft(head, await kit.report(head, { id: saved.id, unit_id: ids.units[0], photos: [] })), "vh:not_found");
    await expectHint(kit.call(otherVideo, "public.delete_progress_report($1)", [saved.id]), "vh:not_found");
    await expectHint(kit.call(head, "public.delete_progress_report($1)", [saved.id]), "vh:not_found");
    const removed = await kit.call<{ removed: string[] }>(video, "public.delete_progress_report($1)", [saved.id]);
    expect(removed.removed).toEqual([first!.path]);
    expect(await kit.status(saved.id)).toBeUndefined();
    expect(await journal(saved.id)).toEqual([]);
  });

  it("черновик → «На проверку»: полная проверка, одна запись журнала, время — момент отправки", async () => {
    const saved = await kit.draft(
      video,
      await kit.report(video, { unit_id: ids.units[0], photos: await kit.photos(video, 2), comment: { ru: "Есть", uz: "" } }),
    );
    await db.admin.query("update progress_reports set created_at = now() - interval '3 days' where id = $1", [saved.id]);
    const kept = await kit.storedPhotos(saved.id);
    await expectHint(kit.submit(video, await kit.report(video, { id: saved.id, unit_id: ids.units[0], photos: kept })), "vh:photos");
    const full = [...kept, await kit.photo(video)];
    await expectHint(
      kit.submit(video, await kit.report(video, { id: saved.id, unit_id: ids.units[0], photos: full, comment: { ru: "Есть", uz: "" } })),
      "vh:comment",
    );
    const sent = await kit.submit(video, await kit.report(video, { id: saved.id, unit_id: ids.units[0], photos: full }));
    expect(sent.status).toBe("review");
    expect(sent.notice).toMatchObject({ complex: expect.any(String), block: expect.any(String), shot_on: dates.today });
    // Сдвиг created_at выше — правка теста (своя запись); от функций — одна запись отправки.
    const entries = (await journal(saved.id)).filter((entry) => !("created_at" in entry.changes && !("status" in entry.changes)));
    expect(entries.map((entry) => entry.action)).toEqual(["update"]);
    expect(entries[0]!.changes).toMatchObject({ status: ["draft", "review"] });
    const fresh = await db.admin.query<{ fresh: boolean }>(
      "select created_at > now() - interval '1 minute' as fresh from progress_reports where id = $1",
      [saved.id],
    );
    expect(fresh.rows[0]!.fresh).toBe(true);
    // Отправленный отчёт автор больше не правит черновиком и не удаляет.
    await expectHint(kit.draft(video, await kit.report(video, { id: saved.id, unit_id: ids.units[0], photos: full })), "vh:stale");
    await expectHint(kit.call(video, "public.delete_progress_report($1)", [saved.id]), "vh:forbidden");
  });

  it("возвращённый сохраняется неполным: статус и причина остаются; удаление автором — в журнал", async () => {
    const { id } = await kit.submit(video, await kit.report(video, { unit_id: ids.units[0] }));
    await kit.call(head, "public.return_progress_report($1, $2)", [id, "Переснять двор"]);
    const kept = await kit.storedPhotos(id);
    const saved = await kit.draft(
      video,
      await kit.report(video, { id, unit_id: ids.units[0], photos: kept.slice(0, 1), comment: { ru: "Позже", uz: "" } }),
    );
    expect(saved.status).toBe("returned");
    expect(saved.removed).toHaveLength(2);
    const after = await db.admin.query("select status, return_note from progress_reports where id = $1", [id]);
    expect(after.rows[0]).toEqual({ status: "returned", return_note: "Переснять двор" });
    await kit.call(video, "public.delete_progress_report($1)", [id]);
    expect((await journal(id)).map((entry) => entry.action)).toContain("delete");
  });

  it("потолки: 30 черновиков и 30 отчётов на проверке у автора", async () => {
    const author = await createStaff(db.admin, "mobilographer");
    const base = { block_id: ids.publicBlock, shot_on: dates.today, comment: { ru: "", uz: "" }, photos: [] };
    for (let i = 0; i < 30; i += 1) await kit.draft(author, { ...base, unit_id: ids.units[0] });
    await expectHint(kit.draft(author, { ...base, unit_id: ids.units[0] }), "vh:limit");

    const sender = await createStaff(db.admin, "mobilographer");
    await db.admin.query(
      `insert into progress_reports (complex_id, block_id, is_unit, month, shot_on, comment, author_id, status)
       select $1, $2, true, date_trunc('month', private.tashkent_today()), private.tashkent_today(),
              '{"ru": "а", "uz": "b"}', $3, 'review' from generate_series(1, 30)`,
      [ids.publicComplex, ids.publicBlock, sender],
    );
    await expectHint(kit.submit(sender, await kit.report(sender, { unit_id: ids.units[0] })), "vh:limit");
  });
});
