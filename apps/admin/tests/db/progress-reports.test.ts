import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, expectDenied, expectHint, user, type TestDb } from "./harness";
import { progressKit, tashkentDates, type Dates } from "./progress-fixtures";

// Фаза 5 (5A.1) и Проект-2, фаза E (20261103140000, 20261103150000): отчёты хода строительства — кто
// отправляет, проверяет, публикует и видит; правила отчёта (дата съёмки, 3–15 фото, комментарий RU и UZ,
// видео — одно, файлы — свои загрузки incoming), возврат и повторная отправка, удаление с файлами,
// снимок квартиры для ссылки клиента, сайт.

describe("отчёты хода строительства: права и правила", () => {
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

  const row = async (id: string, columns: string) =>
    (await db.admin.query(`select ${columns} from progress_reports where id = $1`, [id])).rows[0];

  it("мобилограф отправляет отчёт блока за месяц; второй за тот же месяц — отказ, за прошлый — можно", async () => {
    const first = await kit.submit(video, await kit.report(video));
    expect(first.complex_id).toBe(ids.publicComplex);
    expect(await kit.status(first.id)).toBe("review");
    expect(await row(first.id, "to_char(month, 'YYYY-MM-DD') as month, shot_on::text as shot")).toEqual({
      month: dates.month,
      shot: dates.today,
    });
    await expectHint(kit.submit(video, await kit.report(video)), "vh:duplicate");
    const previous = await kit.submit(video, await kit.report(video, { shot_on: dates.prev }));
    expect(await row(previous.id, "to_char(month, 'YYYY-MM-DD') as month")).toEqual({ month: dates.prevMonth });
  });

  it("дата съёмки: сегодня и до 60 дней назад; завтра и 61 день — отказ", async () => {
    const unit = ids.units[0];
    await kit.submit(video, await kit.report(video, { unit_id: unit, shot_on: dates.d60 }));
    await expectHint(kit.submit(video, await kit.report(video, { unit_id: unit, shot_on: dates.d61 })), "vh:shot_date");
    await expectHint(kit.submit(video, await kit.report(video, { unit_id: unit, shot_on: dates.tomorrow })), "vh:shot_date");
    await expectHint(kit.submit(video, await kit.report(video, { unit_id: unit, shot_on: null })), "vh:shot_date");
    await expectHint(kit.submit(video, await kit.report(video, { unit_id: unit, shot_on: "31.02" })), "vh:invalid");
  });

  it("правила: 3–15 фото своего ЖК, комментарий на двух языках, видео — файл или YouTube; менеджер не отправляет", async () => {
    const unit = ids.units[0];
    const report = (patch: Record<string, unknown>) => kit.report(video, { unit_id: unit, ...patch });
    await expectHint(kit.submit(video, await report({ photos: await kit.photos(video, 2) })), "vh:photos");
    await expectHint(kit.submit(video, await report({ photos: await kit.photos(video, 16) })), "vh:photos");
    await expectHint(
      kit.submit(video, await report({ photos: await kit.photos(video, 3, ids.draftComplex) })),
      "vh:invalid",
    );
    await expectHint(kit.submit(video, await report({ comment: { ru: "Только по-русски", uz: " " } })), "vh:comment");
    await expectHint(kit.submit(video, await report({ comment: { ru: "я".repeat(301), uz: "a" } })), "vh:comment");
    await expectHint(
      kit.submit(
        video,
        await report({ youtube_id: "dQw4w9WgXcQ", video_path: await kit.upload(video, { ext: "mp4" }) }),
      ),
      "vh:invalid",
    );
    await expectHint(kit.submit(video, await report({ youtube_id: "не ссылка" })), "vh:youtube");
    await expectHint(kit.submit(video, await report({ unit_id: ids.units[3] })), "vh:sold");
    await expectHint(kit.submit(video, await report({ block_id: crypto.randomUUID() })), "vh:not_found");
    await expectHint(kit.submit(video, await report({ block_id: "не uuid" })), "vh:invalid");
    await expectHint(kit.submit(manager, await kit.report(manager, { unit_id: unit })), "vh:forbidden");
    await kit.submit(video, await report({ video_path: await kit.upload(video, { ext: "mp4" }) }));
  });

  it("файлы — только свежие свои загрузки incoming нужного вида и размера", async () => {
    const unit = ids.units[0];
    const withPhoto = async (path: string) =>
      kit.report(video, { unit_id: unit, photos: [...(await kit.photos(video, 2)), { path, width: 10, height: 10 }] });
    const bad = [
      await kit.upload(otherVideo),
      await kit.upload(video, { age: "25 hours" }),
      await kit.upload(video, { mimetype: "video/mp4" }),
      await kit.upload(video, { size: 15_728_641 }),
      `${video}/${ids.publicComplex}/${crypto.randomUUID()}.jpg`,
      `complexes/${ids.publicComplex}/${crypto.randomUUID()}.jpg`,
    ];
    for (const path of bad) await expectHint(kit.submit(video, await withPhoto(path)), "vh:invalid");
    await expectHint(
      kit.submit(video, await kit.report(video, { unit_id: unit, video_path: await kit.upload(video, { ext: "mp4", size: 52_428_801 }) })),
      "vh:invalid",
    );
    await expectHint(
      kit.submit(video, await kit.report(video, { unit_id: unit, video_path: await kit.upload(video) })),
      "vh:invalid",
    );
  });

  it("отчёт квартиры: сколько угодно за месяц, снимок квартиры переживает её удаление", async () => {
    const unitReport = await kit.submit(video, await kit.report(video, { unit_id: ids.units[1], youtube_id: "dQw4w9WgXcQ" }));
    await kit.submit(video, await kit.report(video, { unit_id: ids.units[1] }));
    const snapshot = () =>
      row(unitReport.id, "is_unit, unit_id, layout_id, unit_rooms, unit_area::text as unit_area, unit_floor");
    expect(await snapshot()).toEqual({
      is_unit: true,
      unit_id: ids.units[1],
      layout_id: ids.oneRoomLayout,
      unit_rooms: 1,
      unit_area: "42.50",
      unit_floor: 2,
    });
    await db.admin.query("delete from units where id = $1", [ids.units[1]]);
    expect(await snapshot()).toMatchObject({ is_unit: true, unit_id: null, unit_rooms: 1, unit_floor: 2 });
  });

  it("видят: руководитель и менеджер — отправленные, мобилограф — свои (и их фото); посетитель — ничего", async () => {
    const mine = await kit.submit(otherVideo, await kit.report(otherVideo, { unit_id: ids.units[0] }));
    const column = { progress_reports: "id", progress_photos: "report_id" };
    const count = (actor: string, table: keyof typeof column) =>
      db
        .as(user(actor), (tx) =>
          tx.query<{ n: string }>(`select count(*) as n from ${table} where ${column[table]} = $1`, [mine.id]),
        )
        .then((result) => Number(result.rows[0]!.n));
    expect(await count(otherVideo, "progress_reports")).toBe(1);
    expect(await count(otherVideo, "progress_photos")).toBe(3);
    expect(await count(video, "progress_reports")).toBe(0);
    expect(await count(video, "progress_photos")).toBe(0);
    expect(await count(manager, "progress_reports")).toBe(1);
    expect(await count(head, "progress_photos")).toBe(3);
    await expectDenied(db.as(anon, (tx) => tx.query("select * from progress_reports")));
    await expectDenied(db.as(anon, (tx) => tx.query("select * from progress_photos")));
  });

  it("прямой записи нет ни у кого: только функции", async () => {
    for (const actor of [video, manager, head]) {
      await expectDenied(
        db.as(user(actor), (tx) =>
          tx.query(
            `insert into progress_reports (complex_id, block_id, month, shot_on, comment, author_id, status, published_at)
             values ($1, $2, $3, $4, '{"ru": "а", "uz": "b"}', $5, 'published', now())`,
            [ids.publicComplex, ids.publicBlock, dates.month, dates.today, actor],
          ),
        ),
      );
      await expectDenied(db.as(user(actor), (tx) => tx.query("update progress_reports set status = 'published'")));
      await expectDenied(db.as(user(actor), (tx) => tx.query("delete from progress_photos")));
    }
  });

  // Одобряет только руководитель (PLAN §10, п. 6): менеджер видит отчёт, но не публикует и не возвращает.
  it("публикует только руководитель и только с отметкой правила 1.2; снимает с публикации — тоже он", async () => {
    const { id } = await kit.submit(video, await kit.report(video, { unit_id: ids.units[2] }));
    await expectHint(kit.publish(video, id), "vh:forbidden");
    await expectHint(kit.publish(manager, id), "vh:forbidden");
    await expectHint(kit.call(manager, "public.return_progress_report($1, $2)", [id, "Контакты в кадре"]), "vh:forbidden");
    await expectHint(kit.publish(head, id, false), "vh:rule12");
    expect(await kit.status(id)).toBe("review");
    const published = await kit.publish(head, id);
    expect(published).toMatchObject({ complex_id: ids.publicComplex, author_id: video });
    expect(published.incoming).toHaveLength(3);
    expect(await row(id, "status, published_by")).toEqual({ status: "published", published_by: head });
    for (const path of await kit.paths(id)) expect(path).toMatch(/^complexes\//);
    await expectHint(kit.publish(head, id), "vh:stale");
    await expectHint(kit.call(manager, "public.unpublish_progress_report($1)", [id]), "vh:forbidden");
    await kit.call(head, "public.unpublish_progress_report($1)", [id]);
    expect(await kit.status(id)).toBe("review");
    // Повторной публикации копировать нечего — пути уже публичные.
    expect((await kit.publishFiles(head, id)).files).toEqual([]);
    await kit.publish(head, id);
    expect(await kit.status(id)).toBe("published");
  });

  it("возврат с причиной → мобилограф исправляет и отправляет снова; лишние файлы — серверу на удаление", async () => {
    const kept = await kit.photos(video, 3);
    const { id } = await kit.submit(
      video,
      await kit.report(video, { unit_id: ids.units[0], photos: [...kept, await kit.photo(video)] }),
    );
    await expectHint(kit.call(head, "public.return_progress_report($1, $2)", [id, "  "]), "vh:note");
    await expectHint(kit.call(video, "public.return_progress_report($1, $2)", [id, "Контакты в кадре"]), "vh:forbidden");
    const returned = await kit.call<{ author_id: string; removed: string[] }>(
      head,
      "public.return_progress_report($1, $2)",
      [id, "Контакты в кадре"],
    );
    expect(returned).toMatchObject({ author_id: video, removed: [] });
    expect(await row(id, "status, return_note")).toEqual({ status: "returned", return_note: "Контакты в кадре" });

    const fix = await kit.report(video, {
      id,
      unit_id: ids.units[0],
      photos: kept,
      comment: { ru: "Переснято", uz: "Qayta olindi" },
    });
    await expectHint(kit.submit(otherVideo, fix), "vh:not_found");
    const resubmitted = await kit.submit(video, fix);
    expect(resubmitted.removed).toHaveLength(1);
    expect(
      await row(
        id,
        "status, return_note, comment ->> 'ru' as ru, (select count(*)::int from progress_photos where report_id = $1) as photos",
      ),
    ).toEqual({ status: "review", return_note: null, ru: "Переснято", photos: 3 });
    await expectHint(kit.submit(video, fix), "vh:stale");
  });

  it("удаление: автор — свой черновик или возвращённый, руководитель — любой; файлы отчёта — серверу", async () => {
    const sent = await kit.submit(video, await kit.report(video, { unit_id: ids.units[0] }));
    await expectHint(kit.call(otherVideo, "public.delete_progress_report($1)", [sent.id]), "vh:not_found");
    await expectHint(kit.call(manager, "public.delete_progress_report($1)", [sent.id]), "vh:forbidden");
    await expectHint(kit.call(video, "public.delete_progress_report($1)", [sent.id]), "vh:forbidden");
    await kit.call(head, "public.return_progress_report($1, $2)", [sent.id, "Переснять"]);
    const removed = await kit.call<{ removed: string[] }>(video, "public.delete_progress_report($1)", [sent.id]);
    expect(removed.removed).toHaveLength(3);
    expect(await kit.status(sent.id)).toBeUndefined();

    const published = await kit.submit(
      video,
      await kit.report(video, { unit_id: ids.units[0], video_path: await kit.upload(video, { ext: "mp4" }) }),
    );
    await kit.publish(head, published.id);
    await expectHint(kit.call(video, "public.delete_progress_report($1)", [published.id]), "vh:forbidden");
    const byHead = await kit.call<{ removed: string[] }>(head, "public.delete_progress_report($1)", [published.id]);
    expect(byHead.removed).toHaveLength(4);
    expect(byHead.removed.at(-1)).toMatch(/^complexes\/.+\.mp4$/);
  });

  it("только свои файлы: путь галереи ЖК или чужого отчёта — отказ (их удалил бы сервер)", async () => {
    const gallery = (
      await db.admin.query<{ path: string }>("select path from media_assets where id = $1", [ids.publicPhoto])
    ).rows[0]!.path;
    const withPhoto = async (actor: string, path: string) =>
      kit.report(actor, { unit_id: ids.units[0], photos: [...(await kit.photos(actor, 2)), { path, width: 10, height: 10 }] });
    await expectHint(kit.submit(video, await withPhoto(video, gallery)), "vh:invalid");
    const taken = await kit.submit(video, await kit.report(video, { unit_id: ids.units[0] }));
    const [takenPath] = await kit.paths(taken.id);
    await expectHint(kit.submit(otherVideo, await withPhoto(otherVideo, takenPath!)), "vh:invalid");
    await expectHint(kit.submit(video, await withPhoto(video, takenPath!)), "vh:invalid");
    const mp4 = await kit.upload(video, { ext: "mp4" });
    await kit.submit(video, await kit.report(video, { unit_id: ids.units[0], video_path: mp4 }));
    await expectHint(kit.submit(video, await kit.report(video, { unit_id: ids.units[0], video_path: mp4 })), "vh:invalid");
    // Ширина «1000.0» — тоже целое число.
    const [first, ...rest] = await kit.photos(video, 3);
    await kit.submit(video, await kit.report(video, { unit_id: ids.units[0], photos: [{ ...first!, width: 1000.0 }, ...rest] }));
  });

  it("руководитель исправляет возвращённый отчёт сам: файлы мобилографа и старая дата съёмки проходят", async () => {
    const { id } = await kit.submit(video, await kit.report(video, { unit_id: ids.units[0], shot_on: dates.prev }));
    await kit.call(head, "public.return_progress_report($1, $2)", [id, "Нет двора"]);
    await db.admin.query(
      "update progress_reports set shot_on = $2::date, month = date_trunc('month', $2::date) where id = $1",
      [id, dates.d61],
    );
    const photos = await kit.storedPhotos(id);
    await kit.submit(head, await kit.report(head, { id, unit_id: ids.units[0], shot_on: dates.d61, photos }));
    expect(await kit.status(id)).toBe("review");
  });

  it("удаление блока и квартиры: отчёты уходят с блоком без отдельных записей журнала, связь с квартирой — без правки", async () => {
    const block = (
      await db.admin.query<{ id: string }>(
        "insert into blocks (complex_id, name, sort) values ($1, 'Z', 9) returning id",
        [ids.publicComplex],
      )
    ).rows[0]!.id;
    const unit = (
      await db.admin.query<{ id: string }>(
        "insert into units (block_id, entrance, floor, position, number) values ($1, 1, 3, 1, '901') returning id",
        [block],
      )
    ).rows[0]!.id;
    const blockReport = await kit.submit(video, await kit.report(video, { block_id: block }));
    const unitReport = await kit.submit(video, await kit.report(video, { block_id: block, unit_id: unit }));
    const journal = (id: string) =>
      db.admin
        .query<{ action: string }>(
          "select action::text from audit_log where entity = 'progress_reports' and entity_id = $1 order by id",
          [id],
        )
        .then((result) => result.rows.map((item) => item.action));
    await db.admin.query("delete from units where id = $1", [unit]);
    expect(await journal(unitReport.id)).toEqual(["insert"]);
    await db.admin.query("delete from blocks where id = $1", [block]);
    expect(await kit.status(blockReport.id)).toBeUndefined();
    expect(await journal(blockReport.id)).toEqual(["insert"]);
  });

  it("сайт: «Ход строительства» — только опубликованные отчёты блоков видимого ЖК, новые сверху, «снято» — дата съёмки", async () => {
    const site = (complex: string) =>
      db
        .as(anon, (tx) =>
          tx.query<{
            r: { id: string; month: string; shot_at: string; photos: { path: string }[]; block: { name: string } }[] | null;
          }>("select public.site_complex_progress($1) as r", [complex]),
        )
        .then((result) => result.rows[0]!.r);
    const before = (await site(ids.publicComplex))!.length;
    const unitReport = await kit.submit(video, await kit.report(video, { shot_on: dates.prev, unit_id: ids.units[0] }));
    const published = (
      await db.admin.query<{ id: string }>(
        "select id from progress_reports where block_id = $1 and not is_unit and month = $2 and status = 'review'",
        [ids.publicBlock, dates.month],
      )
    ).rows[0]!.id;
    await kit.publish(head, published);
    await kit.publish(head, unitReport.id);
    const items = (await site(ids.publicComplex))!;
    expect(items.length).toBe(before + 1);
    expect(items[0]).toMatchObject({ id: published, month: dates.month, shot_at: dates.today, block: { name: expect.any(String) } });
    expect(items[0]!.photos).toHaveLength(3);
    for (const item of items[0]!.photos) expect(item.path).toMatch(/^complexes\//);
    expect(items.map((item) => item.id)).not.toContain(unitReport.id);
    expect(await site(ids.draftComplex)).toBeNull();

    // 5C.3: кадры для каталога и главной — последний отчёт блока ЖК на сайте, не квартиры.
    const frames = (
      await db.as(anon, (tx) =>
        tx.query<{
          r: { complex_id: string; report_id: string; block: string; photos: { path: string }[] }[];
        }>("select public.site_progress_frames() as r"),
      )
    ).rows[0]!.r;
    const frame = frames.find((item) => item.complex_id === ids.publicComplex);
    expect(frame).toMatchObject({ report_id: published, block: expect.any(String) });
    expect(frame!.photos).toHaveLength(3);
    expect(frames.map((item) => item.report_id)).not.toContain(unitReport.id);
    expect(frames.map((item) => item.complex_id)).not.toContain(ids.draftComplex);
  });

  it("сайт: видео квартиры — опубликованный отчёт по квартире без номера, id квартиры и цены; история — квартира и блок", async () => {
    const { id } = await kit.submit(video, await kit.report(video, { unit_id: ids.units[2], youtube_id: "dQw4w9WgXcQ" }));
    const page = (reportId: string) =>
      db
        .as(anon, (tx) => tx.query<{ r: Record<string, unknown> | null }>("select public.site_unit_video($1) as r", [reportId]))
        .then((result) => result.rows[0]?.r ?? null);
    expect(await page(id)).toBeNull();
    await kit.publish(head, id);
    const video_ = (await page(id))!;
    expect(Object.keys(video_).sort()).toEqual(
      [
        "area",
        "block",
        "comment",
        "complex",
        "floor",
        "history",
        "id",
        "is_unit",
        "layout_id",
        "month",
        "photos",
        "rooms",
        "shot_at",
        "video_path",
        "youtube_id",
      ].sort(),
    );
    expect(video_).toMatchObject({
      rooms: 2,
      floor: 2,
      layout_id: ids.twoRoomLayout,
      youtube_id: "dQw4w9WgXcQ",
      shot_at: dates.today,
    });
    expect(JSON.stringify(video_)).not.toMatch(/"number"|"unit_id"|"price"/);
    expect((video_.history as { id: string }[]).length).toBeGreaterThan(0);
    const blockReport = (
      await db.admin.query<{ id: string }>(
        "select id from progress_reports where block_id = $1 and not is_unit and status = 'published' limit 1",
        [ids.publicBlock],
      )
    ).rows[0]!.id;
    expect(await page(blockReport)).toBeNull();
  });

  it("обзор для кабинета: руководитель и менеджер видят статусы отчётов блоков и последние видео; мобилограф и посетитель — нет", async () => {
    type Overview = {
      complexes: { id: string; built: boolean }[];
      reports: { id: string; status: string }[];
      videos: { id: string; unit: string | null; shot_at: string }[];
    };
    const overview = (actor: string) => kit.call<Overview | null>(actor, "public.progress_overview()");
    const published = (
      await db.admin.query<{ id: string }>("select id from progress_reports where status = 'published' and not is_unit limit 1")
    ).rows[0]!.id;
    for (const actor of [manager, head]) {
      const data = (await overview(actor))!;
      expect(data.complexes.map((complex) => complex.id)).toContain(ids.publicComplex);
      expect(data.reports.map((item) => item.id)).toContain(published);
      expect(data.videos.length).toBeGreaterThan(0);
      expect(data.videos[0]!.shot_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(JSON.stringify(data.reports)).not.toMatch(/comment|path/);
    }
    expect(await overview(video)).toBeNull();
    await expectDenied(db.as(anon, (tx) => tx.query("select public.progress_overview()")));
  });

  it("журнал: отправка, публикация и удаление отчёта — записи с ЖК", async () => {
    const { rows } = await db.admin.query<{ action: string; n: number }>(
      "select action::text, count(*)::int as n from audit_log where entity = 'progress_reports' and complex_id = $1 group by action order by action",
      [ids.publicComplex],
    );
    expect(rows.map((item) => item.action)).toEqual(["delete", "insert", "update"]);
  });
});
