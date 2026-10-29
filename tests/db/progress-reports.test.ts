import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  user,
  type Db,
  type TestDb,
} from "./harness";

// Фаза 5 (5A.1): отчёты хода строительства (миграция 20261029100000_progress_reports.sql) — кто отправляет,
// проверяет, публикует и видит; правила отчёта (месяц, 3–15 фото, комментарий RU и UZ, видео — одно),
// возврат и повторная отправка, удаление с файлами, снимок квартиры для ссылки клиента.

type Submitted = { id: string; complex_id: string; removed: string[] };

describe("отчёты хода строительства: права и правила", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;
  let video: string;
  let otherVideo: string;
  let month: string;
  let previous: string;
  let longAgo: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    video = await createStaff(db.admin, "videographer");
    otherVideo = await createStaff(db.admin, "videographer");
    const { rows } = await db.admin.query<{ m: string; p: string; l: string }>(
      `select to_char(date_trunc('month', private.tashkent_today()), 'YYYY-MM-DD') as m,
              to_char(date_trunc('month', private.tashkent_today()) - interval '1 month', 'YYYY-MM-DD') as p,
              to_char(date_trunc('month', private.tashkent_today()) - interval '2 months', 'YYYY-MM-DD') as l`,
    );
    ({ m: month, p: previous, l: longAgo } = rows[0]!);
  });
  afterAll(() => db.close());

  const photo = (complex = ids.publicComplex) => ({
    path: `complexes/${complex}/${crypto.randomUUID()}.jpg`,
    width: 1600,
    height: 1200,
  });
  const photos = (n: number, complex?: string) => Array.from({ length: n }, () => photo(complex));
  const report = (patch: Record<string, unknown> = {}) => ({
    block_id: ids.publicBlock,
    month,
    comment: { ru: "Залит 9-й этаж", uz: "9-qavat quyildi" },
    photos: photos(3),
    ...patch,
  });
  const call = <T>(actor: string, sql: string, params: unknown[]) =>
    db
      .as(user(actor), (tx: Db) => tx.query<{ r: T }>(`select ${sql} as r`, params))
      .then((result) => result.rows[0]!.r);
  const submit = (actor: string, body: Record<string, unknown>) =>
    call<Submitted>(actor, "public.submit_progress_report($1)", [JSON.stringify(body)]);
  const publish = (actor: string, id: string, checked = true) =>
    call<{ complex_id: string }>(actor, "public.publish_progress_report($1, $2)", [id, checked]);
  const status = async (id: string) =>
    (
      await db.admin.query<{ status: string }>(
        "select status from progress_reports where id = $1",
        [id],
      )
    ).rows[0]?.status;

  it("видеограф отправляет отчёт блока за месяц; второй за тот же месяц — отказ, за прошлый — можно", async () => {
    const first = await submit(video, report());
    expect(first.complex_id).toBe(ids.publicComplex);
    expect(await status(first.id)).toBe("review");
    await expectHint(submit(video, report()), "vh:duplicate");
    await submit(video, report({ month: previous }));
    await expectHint(submit(video, report({ month: longAgo })), "vh:month");
  });

  it("правила: 3–15 фото своего ЖК, комментарий на двух языках, видео — файл или YouTube; менеджер не отправляет", async () => {
    const unit = ids.units[0];
    await expectHint(submit(video, report({ unit_id: unit, photos: photos(2) })), "vh:photos");
    await expectHint(submit(video, report({ unit_id: unit, photos: photos(16) })), "vh:photos");
    await expectHint(
      submit(video, report({ unit_id: unit, photos: photos(3, ids.draftComplex) })),
      "vh:invalid",
    );
    await expectHint(
      submit(video, report({ unit_id: unit, comment: { ru: "Только по-русски", uz: " " } })),
      "vh:comment",
    );
    await expectHint(
      submit(
        video,
        report({
          unit_id: unit,
          youtube_id: "dQw4w9WgXcQ",
          video_path: `complexes/${ids.publicComplex}/${crypto.randomUUID()}.mp4`,
        }),
      ),
      "vh:invalid",
    );
    await expectHint(
      submit(video, report({ unit_id: unit, youtube_id: "не ссылка" })),
      "vh:youtube",
    );
    await expectHint(submit(video, report({ unit_id: ids.units[3] })), "vh:sold");
    await expectHint(submit(video, report({ block_id: crypto.randomUUID() })), "vh:not_found");
    await expectHint(submit(video, report({ block_id: "не uuid" })), "vh:invalid");
    await expectHint(submit(manager, report({ unit_id: unit })), "vh:forbidden");
  });

  it("отчёт квартиры: сколько угодно за месяц, снимок квартиры переживает её удаление", async () => {
    const unitReport = await submit(
      video,
      report({ unit_id: ids.units[1], youtube_id: "dQw4w9WgXcQ" }),
    );
    await submit(video, report({ unit_id: ids.units[1] }));
    const snapshot = async () =>
      (
        await db.admin.query(
          "select is_unit, unit_id, layout_id, unit_rooms, unit_area::text as unit_area, unit_floor from progress_reports where id = $1",
          [unitReport.id],
        )
      ).rows[0];
    expect(await snapshot()).toEqual({
      is_unit: true,
      unit_id: ids.units[1],
      layout_id: ids.oneRoomLayout,
      unit_rooms: 1,
      unit_area: "42.50",
      unit_floor: 2,
    });
    await db.admin.query("delete from units where id = $1", [ids.units[1]]);
    expect(await snapshot()).toMatchObject({
      is_unit: true,
      unit_id: null,
      unit_rooms: 1,
      unit_floor: 2,
    });
  });

  it("видят: руководитель и менеджер — все, видеограф — свои (и их фото); посетитель — ничего", async () => {
    const mine = await submit(otherVideo, report({ unit_id: ids.units[0] }));
    const column = { progress_reports: "id", progress_photos: "report_id" };
    const count = (actor: string, table: keyof typeof column) =>
      db
        .as(user(actor), (tx) =>
          tx.query<{ n: string }>(
            `select count(*) as n from ${table} where ${column[table]} = $1`,
            [mine.id],
          ),
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
            `insert into progress_reports (complex_id, block_id, month, comment, author_id, status, published_at)
             values ($1, $2, $3, '{"ru": "а", "uz": "b"}', $4, 'published', now())`,
            [ids.publicComplex, ids.publicBlock, month, actor],
          ),
        ),
      );
      await expectDenied(
        db.as(user(actor), (tx) => tx.query("update progress_reports set status = 'published'")),
      );
      await expectDenied(db.as(user(actor), (tx) => tx.query("delete from progress_photos")));
    }
  });

  it("публикует менеджер или руководитель — только с отметкой правила 1.2; снимает с публикации — руководитель", async () => {
    const { id } = await submit(video, report({ unit_id: ids.units[2] }));
    await expectHint(publish(video, id), "vh:forbidden");
    await expectHint(publish(manager, id, false), "vh:rule12");
    expect(await status(id)).toBe("review");
    expect((await publish(manager, id)).complex_id).toBe(ids.publicComplex);
    const row = (
      await db.admin.query("select status, published_by from progress_reports where id = $1", [id])
    ).rows[0];
    expect(row).toEqual({ status: "published", published_by: manager });
    await expectHint(publish(head, id), "vh:stale");
    await expectHint(call(manager, "public.unpublish_progress_report($1)", [id]), "vh:forbidden");
    await call(head, "public.unpublish_progress_report($1)", [id]);
    expect(await status(id)).toBe("review");
  });

  it("возврат с причиной → видеограф исправляет и отправляет снова; лишние файлы — серверу на удаление", async () => {
    const kept = photos(3);
    const { id } = await submit(
      video,
      report({ unit_id: ids.units[0], photos: [...kept, photo()] }),
    );
    await expectHint(call(manager, "public.return_progress_report($1, $2)", [id, "  "]), "vh:note");
    await expectHint(
      call(video, "public.return_progress_report($1, $2)", [id, "Контакты в кадре"]),
      "vh:forbidden",
    );
    await call(manager, "public.return_progress_report($1, $2)", [id, "Контакты в кадре"]);
    const returned = (
      await db.admin.query("select status, return_note from progress_reports where id = $1", [id])
    ).rows[0];
    expect(returned).toEqual({ status: "returned", return_note: "Контакты в кадре" });

    const fix = report({
      id,
      unit_id: ids.units[0],
      photos: kept,
      comment: { ru: "Переснято", uz: "Qayta olindi" },
    });
    await expectHint(submit(otherVideo, fix), "vh:not_found");
    const resubmitted = await submit(video, fix);
    expect(resubmitted.removed).toHaveLength(1);
    const after = (
      await db.admin.query(
        "select status, return_note, comment ->> 'ru' as ru, (select count(*)::int from progress_photos where report_id = $1) as photos from progress_reports where id = $1",
        [id],
      )
    ).rows[0];
    expect(after).toEqual({ status: "review", return_note: null, ru: "Переснято", photos: 3 });
    await expectHint(submit(video, fix), "vh:stale");
  });

  it("удаление: автор — свой неопубликованный, руководитель — любой; файлы отчёта — серверу", async () => {
    const draft = await submit(video, report({ unit_id: ids.units[0] }));
    await expectHint(
      call(otherVideo, "public.delete_progress_report($1)", [draft.id]),
      "vh:not_found",
    );
    await expectHint(
      call(manager, "public.delete_progress_report($1)", [draft.id]),
      "vh:forbidden",
    );
    const removed = await call<{ removed: string[] }>(video, "public.delete_progress_report($1)", [
      draft.id,
    ]);
    expect(removed.removed).toHaveLength(3);
    expect(await status(draft.id)).toBeUndefined();

    const published = await submit(
      video,
      report({
        unit_id: ids.units[0],
        video_path: `complexes/${ids.publicComplex}/${crypto.randomUUID()}.mp4`,
      }),
    );
    await publish(manager, published.id);
    await expectHint(
      call(video, "public.delete_progress_report($1)", [published.id]),
      "vh:forbidden",
    );
    const byHead = await call<{ removed: string[] }>(head, "public.delete_progress_report($1)", [
      published.id,
    ]);
    expect(byHead.removed).toHaveLength(4);
    expect(byHead.removed.at(-1)).toMatch(/\.mp4$/);
  });

  it("только свои файлы: путь галереи ЖК или чужого отчёта — отказ (их удалил бы сервер)", async () => {
    const gallery = (
      await db.admin.query<{ path: string }>("select path from media_assets where id = $1", [
        ids.publicPhoto,
      ])
    ).rows[0]!.path;
    await expectHint(
      submit(
        video,
        report({
          unit_id: ids.units[0],
          photos: [...photos(2), { path: gallery, width: 10, height: 10 }],
        }),
      ),
      "vh:invalid",
    );
    const taken = await submit(video, report({ unit_id: ids.units[0] }));
    const takenPath = (
      await db.admin.query<{ path: string }>(
        "select path from progress_photos where report_id = $1 limit 1",
        [taken.id],
      )
    ).rows[0]!.path;
    await expectHint(
      submit(
        otherVideo,
        report({
          unit_id: ids.units[0],
          photos: [...photos(2), { path: takenPath, width: 10, height: 10 }],
        }),
      ),
      "vh:invalid",
    );
    const mp4 = `complexes/${ids.publicComplex}/${crypto.randomUUID()}.mp4`;
    await submit(video, report({ unit_id: ids.units[0], video_path: mp4 }));
    await expectHint(
      submit(otherVideo, report({ unit_id: ids.units[0], video_path: mp4 })),
      "vh:invalid",
    );
    // Ширина «1000.0» — тоже целое число.
    await submit(
      video,
      report({ unit_id: ids.units[0], photos: [{ ...photo(), width: 1000.0 }, ...photos(2)] }),
    );
  });

  it("руководитель исправляет возвращённый отчёт сам; месяц возвращённого отчёта сохраняется", async () => {
    const { id } = await submit(video, report({ unit_id: ids.units[0], month: previous }));
    await call(manager, "public.return_progress_report($1, $2)", [id, "Нет двора"]);
    await db.admin.query("update progress_reports set month = $2 where id = $1", [id, longAgo]);
    await submit(head, report({ id, unit_id: ids.units[0], month: longAgo }));
    expect(await status(id)).toBe("review");
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
    const blockReport = await submit(video, report({ block_id: block }));
    const unitReport = await submit(video, report({ block_id: block, unit_id: unit }));
    const journal = (id: string) =>
      db.admin
        .query<{ action: string }>(
          "select action::text from audit_log where entity = 'progress_reports' and entity_id = $1 order by id",
          [id],
        )
        .then((result) => result.rows.map((row) => row.action));
    await db.admin.query("delete from units where id = $1", [unit]);
    expect(await journal(unitReport.id)).toEqual(["insert"]);
    await db.admin.query("delete from blocks where id = $1", [block]);
    expect(await status(blockReport.id)).toBeUndefined();
    expect(await journal(blockReport.id)).toEqual(["insert"]);
  });

  it("сайт: «Ход строительства» — только опубликованные отчёты блоков видимого ЖК, новые сверху", async () => {
    const site = (complex: string) =>
      db
        .as(anon, (tx) =>
          tx.query<{
            r: { id: string; month: string; photos: unknown[]; block: { name: string } }[] | null;
          }>("select public.site_complex_progress($1) as r", [complex]),
        )
        .then((result) => result.rows[0]!.r);
    const before = (await site(ids.publicComplex))!.length;
    const draft = await submit(
      video,
      report({ month: previous, block_id: ids.publicBlock, unit_id: ids.units[0] }),
    );
    const published = (
      await db.admin.query<{ id: string }>(
        "select id from progress_reports where block_id = $1 and not is_unit and month = $2",
        [ids.publicBlock, month],
      )
    ).rows[0]!.id;
    await publish(manager, published);
    await publish(manager, draft.id);
    const items = (await site(ids.publicComplex))!;
    expect(items.length).toBe(before + 1);
    expect(items[0]).toMatchObject({ id: published, month, block: { name: expect.any(String) } });
    expect(items[0]!.photos).toHaveLength(3);
    expect(items.map((item) => item.id)).not.toContain(draft.id);
    expect(await site(ids.draftComplex)).toBeNull();
  });

  it("сайт: видео квартиры — опубликованный отчёт по квартире без номера, id квартиры и цены; история — квартира и блок", async () => {
    const { id } = await submit(
      video,
      report({ unit_id: ids.units[2], youtube_id: "dQw4w9WgXcQ" }),
    );
    const page = (reportId: string) =>
      db
        .as(anon, (tx) =>
          tx.query<{ r: Record<string, unknown> | null }>(
            "select public.site_unit_video($1) as r",
            [reportId],
          ),
        )
        .then((result) => result.rows[0]?.r ?? null);
    expect(await page(id)).toBeNull();
    await publish(manager, id);
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

  it("обзор для кабинета: все сотрудники видят статусы отчётов блоков и последние видео, посетитель — нет", async () => {
    type Overview = { complexes: { id: string; built: boolean }[]; reports: { id: string; status: string }[]; videos: { id: string; unit: string | null }[] };
    const overview = (actor: string) => call<Overview | null>(actor, "public.progress_overview()", []);
    const published = (await db.admin.query<{ id: string }>("select id from progress_reports where status = 'published' and not is_unit limit 1")).rows[0]!.id;
    for (const actor of [video, otherVideo, manager, head]) {
      const data = (await overview(actor))!;
      expect(data.complexes.map((complex) => complex.id)).toContain(ids.publicComplex);
      expect(data.reports.map((report) => report.id)).toContain(published);
      expect(data.videos.length).toBeGreaterThan(0);
      expect(JSON.stringify(data.reports)).not.toMatch(/comment|path/);
    }
    await expectDenied(db.as(anon, (tx) => tx.query("select public.progress_overview()")));
  });

  it("журнал: отправка, публикация и удаление отчёта — записи с ЖК", async () => {
    const { rows } = await db.admin.query<{ action: string; n: number }>(
      "select action::text, count(*)::int as n from audit_log where entity = 'progress_reports' and complex_id = $1 group by action order by action",
      [ids.publicComplex],
    );
    expect(rows.map((row) => row.action)).toEqual(["delete", "insert", "update"]);
  });
});
