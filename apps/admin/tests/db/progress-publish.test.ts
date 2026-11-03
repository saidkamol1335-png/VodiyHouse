import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectDenied, expectHint, service, user, type TestDb } from "./harness";
import { progressKit, tashkentDates, type Dates } from "./progress-fixtures";

// Проект-2, фаза E (PLAN §10, пп. 13, 34, 35, 38): публикация с копией файлов incoming → публичные
// бакеты, «Убрать кадр», «Задания», «Медиа ЖК», уборка incoming.

describe("публикация отчёта, «Задания», «Медиа ЖК», уборка", () => {
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

  const sent = async (patch: Record<string, unknown> = {}) =>
    kit.submit(video, await kit.report(video, { unit_id: ids.units[0], ...patch }));
  const asService = <T>(sql: string, params: unknown[] = []) =>
    db.as(service, (tx) => tx.query<{ r: T }>(`select ${sql} as r`, params)).then((result) => result.rows[0]!.r);

  it("адреса копий: только руководитель, с отметкой 1.2, по свежей версии; повтор — те же адреса", async () => {
    const { id } = await sent({ video_path: await kit.upload(video, { ext: "mp4" }) });
    await expectHint(kit.publishFiles(manager, id), "vh:forbidden");
    await expectHint(kit.publishFiles(video, id), "vh:forbidden");
    await expectHint(kit.publishFiles(head, id, false), "vh:rule12");
    await expectHint(kit.publishFiles(head, id, true, null), "vh:stale");
    await expectHint(kit.publishFiles(head, id, true, "2000-01-01T00:00:00Z"), "vh:stale");
    const first = await kit.publishFiles(head, id);
    expect(first.files).toHaveLength(4);
    for (const file of first.files) {
      expect(file.from.startsWith(`${video}/${ids.publicComplex}/`)).toBe(true);
      expect(file.to).toMatch(new RegExp(`^complexes/${ids.publicComplex}/[0-9a-f-]{36}\\.(jpg|mp4)$`));
    }
    expect(first.files.filter((file) => file.bucket === "progress-video")).toHaveLength(1);
    const again = await kit.publishFiles(head, id, true, first.version);
    expect(again.files.map((file) => file.to).sort()).toEqual(first.files.map((file) => file.to).sort());
  });

  it("публикация без копий — vh:files; со старой версией — vh:stale; с копиями — пути публичные", async () => {
    const { id } = await sent({ video_path: await kit.upload(video, { ext: "mp4" }) });
    const files = await kit.publishFiles(head, id);
    const publish = (version: string | null) =>
      kit.call(head, "public.publish_progress_report($1, $2, $3)", [id, true, version]);
    await expectHint(publish(files.version), "vh:files");
    await kit.copy(files.files.slice(0, 2));
    await expectHint(publish(files.version), "vh:files");
    await kit.copy(files.files);
    await expectHint(publish(null), "vh:stale");
    await expectHint(kit.call(head, "public.publish_progress_report($1, $2, $3)", [id, false, files.version]), "vh:rule12");
    const done = await kit.call<{ incoming: string[] }>(head, "public.publish_progress_report($1, $2, $3)", [id, true, files.version]);
    expect(done.incoming.sort()).toEqual(files.files.map((file) => file.from).sort());
    const row = await db.admin.query<{ video_path: string; video_publish_path: string | null }>(
      "select video_path, video_publish_path from progress_reports where id = $1",
      [id],
    );
    expect(row.rows[0]).toEqual({ video_path: expect.stringMatching(/^complexes\/.+\.mp4$/), video_publish_path: null });
    const left = await db.admin.query(
      "select 1 from progress_photos where report_id = $1 and (path not like 'complexes/%' or publish_path is not null)",
      [id],
    );
    expect(left.rows).toHaveLength(0);
    // Опубликованный отчёт не ссылается на incoming и прямой правкой.
    await expect(
      db.admin.query("update progress_reports set video_path = $2 where id = $1", [id, files.files.find((f) => f.bucket === "progress-video")!.from]),
    ).rejects.toThrow(/progress_reports_published_public/);
  });

  // Ревью фазы E: адрес копии виден сотрудникам — подложенный по нему файл не публикуется.
  it("копия, которую положил не сервер (у файла есть владелец), не принимается; менеджер её не сотрёт", async () => {
    const { id } = await sent();
    const files = await kit.publishFiles(head, id);
    for (const file of files.files) {
      await db.admin.query("insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3)", [file.bucket, file.to, manager]);
    }
    await expectHint(kit.call(head, "public.publish_progress_report($1, $2, $3)", [id, true, files.version]), "vh:files");
    await db.admin.query("update storage.objects set created_at = now() - interval '2 hours' where name = any($1)", [
      files.files.map((file) => file.to),
    ]);
    const removed = await db.as(user(manager), async (tx) => {
      await tx.query("select set_config('storage.allow_delete_query', 'true', true)");
      return tx.query("delete from storage.objects where bucket_id = 'media' and name = $1", [files.files[0]!.to]);
    });
    expect(removed.affectedRows).toBe(0);
  });

  it("адрес копии видео не меняет версию: повтор публикации из того же ящика проходит", async () => {
    const { id } = await sent({ video_path: await kit.upload(video, { ext: "mp4" }) });
    const drawer = await kit.version(id);
    const first = await kit.publishFiles(head, id, true, drawer);
    expect(new Date(first.version).getTime()).toBe(new Date(drawer!).getTime());
    const retry = await kit.publishFiles(head, id, true, drawer);
    await kit.copy(retry.files);
    await kit.call(head, "public.publish_progress_report($1, $2, $3)", [id, true, retry.version]);
    expect(await kit.status(id)).toBe("published");
  });

  it("возврат отдаёт назначенные адреса копий серверу на удаление", async () => {
    const { id } = await sent();
    const files = await kit.publishFiles(head, id);
    const returned = await kit.call<{ removed: string[] }>(head, "public.return_progress_report($1, $2)", [id, "Нет двора"]);
    expect(returned.removed.sort()).toEqual(files.files.map((file) => file.to).sort());
    const left = await db.admin.query("select 1 from progress_photos where report_id = $1 and publish_path is not null", [id]);
    expect(left.rows).toHaveLength(0);
  });

  it("«Убрать кадр»: руководитель, отчёт на проверке, остаётся не меньше 3; версия меняется, журнал — одна строка", async () => {
    const { id } = await sent({ photos: await kit.photos(video, 4) });
    const before = await kit.version(id);
    const ids_ = (await db.admin.query<{ id: string; sort: number }>("select id, sort from progress_photos where report_id = $1 order by sort", [id])).rows;
    const remove = (actor: string, photo: string) => kit.call<{ removed: string[] }>(actor, "public.remove_progress_photo($1)", [photo]);
    await expectHint(remove(manager, ids_[1]!.id), "vh:forbidden");
    await expectHint(remove(video, ids_[1]!.id), "vh:forbidden");
    const removed = await remove(head, ids_[1]!.id);
    expect(removed.removed).toHaveLength(1);
    expect((await db.admin.query<{ sort: number }>("select sort from progress_photos where report_id = $1 order by sort", [id])).rows.map((r) => r.sort)).toEqual([1, 3, 4]);
    await expectHint(remove(head, ids_[1]!.id), "vh:not_found");
    await expectHint(remove(head, ids_[0]!.id), "vh:frames");
    expect(await kit.version(id)).not.toBe(before);
    await expectHint(kit.publishFiles(head, id, true, before), "vh:stale");
    const journal = await db.admin.query<{ actor_id: string; changes: unknown }>(
      "select actor_id, changes from audit_log where entity = 'progress_reports' and entity_id = $1 and changes ? 'photos'",
      [id],
    );
    expect(journal.rows).toEqual([{ actor_id: head, changes: { photos: [4, 3] } }]);
    await kit.call(head, "public.return_progress_report($1, $2)", [id, "Ещё"]);
    await expectHint(remove(head, ids_[2]!.id), "vh:stale");
  });

  it("«Задания»: строящиеся блоки текущего месяца — только мобилографу; свой черновик виден, чужой — нет", async () => {
    type Tasks = {
      month: string;
      total: number;
      left: number;
      complexes: { id: string; blocks: { id: string; status: string; report_id: string | null; mine: boolean }[] }[];
    };
    const tasks = (actor: string) => kit.call<Tasks | null>(actor, "public.progress_tasks()");
    const block = (data: Tasks) => data.complexes.flatMap((complex) => complex.blocks).find((item) => item.id === ids.publicBlock)!;
    const start = (await tasks(video))!;
    expect(start.month).toBe(dates.month);
    expect(block(start).status).toBe("none");
    const draft = await kit.draft(otherVideo, await kit.report(otherVideo, { photos: [] }));
    expect(block((await tasks(video))!).status).toBe("none");
    expect(block((await tasks(otherVideo))!)).toMatchObject({ status: "draft", report_id: draft.id, mine: true });
    const report = await kit.submit(video, await kit.report(video));
    const mine = block((await tasks(video))!);
    expect(mine).toMatchObject({ status: "review", report_id: report.id, mine: true });
    expect(block((await tasks(otherVideo))!)).toMatchObject({ status: "review", report_id: null, mine: false });
    const after = (await tasks(video))!;
    expect(after.left).toBe(start.left - 1);
    expect(after.total).toBe(start.total);
    await db.admin.query("update blocks set build_status = 'delivered' where id = $1", [ids.publicBlock]);
    expect(after.complexes.flatMap((c) => c.blocks).some((b) => b.id === ids.publicBlock)).toBe(true);
    expect((await tasks(video))!.complexes.flatMap((c) => c.blocks).some((b) => b.id === ids.publicBlock)).toBe(false);
    await db.admin.query("update blocks set build_status = 'building' where id = $1", [ids.publicBlock]);
    expect(await tasks(head)).toBeNull();
    expect(await tasks(manager)).toBeNull();
    await expectDenied(db.as(anon, (tx) => tx.query("select public.progress_tasks()")));
  });

  it("«Медиа ЖК»: опубликованные отчёты по месяцам, без данных застройщика; архив скрыт; посетителю — нет", async () => {
    const { id } = await sent();
    type Media = { id: string; address: string | null; months: { month: string; reports: { id: string; photos: { path: string }[] }[] }[] };
    const media = (actor: string, complex = ids.publicComplex) => kit.call<Media | null>(actor, "public.progress_media($1)", [complex]);
    expect(JSON.stringify(await media(video))).not.toContain(id);
    await kit.publish(head, id);
    const data = (await media(video))!;
    const item = data.months.flatMap((month) => month.reports).find((report) => report.id === id)!;
    expect(item.photos).toHaveLength(3);
    for (const photo of item.photos) expect(photo.path).toMatch(/^complexes\//);
    expect(JSON.stringify(data)).not.toMatch(/developer|price|number|return_note|comment/);
    const list = await kit.call<{ id: string; reports: number }[]>(manager, "public.progress_media_complexes()");
    expect(list.find((complex) => complex.id === ids.publicComplex)!.reports).toBeGreaterThan(0);
    expect(JSON.stringify(list)).not.toMatch(/developer|price/);
    await db.admin.query("update complexes set status = 'archived' where id = $1", [ids.draftComplex]);
    expect(await media(video, ids.draftComplex)).toBeNull();
    await expectDenied(db.as(anon, (tx) => tx.query("select public.progress_media($1)", [ids.publicComplex])));
    await expectDenied(db.as(anon, (tx) => tx.query("select public.progress_media_complexes()")));
  });

  it("уборка: сироты incoming старше 48 ч; файлы отчётов и черновиков остаются; только сервер", async () => {
    const orphan = await kit.upload(video, { age: "49 hours" });
    const young = await kit.upload(video, { age: "47 hours" });
    const kept = await kit.draft(video, await kit.report(video, { unit_id: ids.units[0], photos: await kit.photos(video, 1) }));
    const [keptPath] = await kit.paths(kept.id);
    await db.admin.query("update storage.objects set created_at = now() - interval '3 days' where name = $1", [keptPath]);
    const orphans = await asService<string[]>("public.progress_incoming_orphans($1)", [1000]);
    expect(orphans).toContain(orphan);
    expect(orphans).not.toContain(young);
    expect(orphans).not.toContain(keptPath);
    const refs = await asService<string[]>("public.progress_public_refs($1)", [[orphan, keptPath]]);
    expect(refs).toEqual([keptPath]);
    for (const actor of [video, head]) {
      await expectDenied(db.as(user(actor), (tx) => tx.query("select public.progress_incoming_orphans(10)")));
      await expectDenied(db.as(user(actor), (tx) => tx.query("select public.progress_public_refs($1)", [[orphan]])));
    }
  });
});
