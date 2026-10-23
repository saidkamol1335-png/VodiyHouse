import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeComplexReady } from "./content-fixtures";
import { createStaff, createTestDb, expectHint, user, type Db, type TestDb } from "./harness";

type Requirement = { requirement: string; ok: boolean; have: number | null };

const name = (ru: string, uz = ru) => JSON.stringify({ ru, uz });
const photoPath = (complexId: string) => `complexes/${complexId}/${crypto.randomUUID()}.jpg`;
const drawingPath = (complexId: string) => `complexes/${complexId}/${crypto.randomUUID()}.png`;

// Шаг 11: кабинет ЖК (миграция 20261021090000_complexes_admin.sql).
describe("кабинет ЖК", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let videographer: string;
  let developer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head", { fullName: "Бахтиёр Каримов" });
    manager = await createStaff(db.admin, "manager");
    videographer = await createStaff(db.admin, "videographer");
    developer = (
      await db.admin.query<{ id: string }>(
        "insert into developers (slug, name, status) values ('zhk-dev', 'Zhk Dev', 'published') returning id",
      )
    ).rows[0]!.id;
  });
  afterAll(() => db.close());

  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);
  const scalar = async <T>(actor: string, sql: string, params: unknown[] = []) =>
    db.as(user(actor), async (tx) => (await tx.query<{ value: T }>(sql, params)).rows[0]!.value);
  const createComplex = (title: string, slug: string, owner = developer) =>
    scalar<string>(head, "select create_complex($1, $2, $3) as value", [owner, name(title), slug]);
  const complexRow = async (id: string) =>
    (
      await db.admin.query<{ slug: string; status: string; sort: number }>(
        "select slug, status, sort from complexes where id = $1",
        [id],
      )
    ).rows[0]!;
  const readiness = (id: string, actor = head) =>
    db.as(user(actor), async (tx) =>
      (await tx.query<Requirement>("select * from complex_readiness($1)", [id])).rows,
    );
  const publish = (id: string) =>
    asHead((tx) =>
      // clock_timestamp, а не now(): облачный прогон — одна транзакция на файл, now() в ней стоит,
      // и повторная отметка 1.2 совпала бы с прошлой.
      tx.query(
        "update complexes set status = 'published', files_checked_at = clock_timestamp() where id = $1",
        [id],
      ),
    );
  const readyPublished = async (slug: string) => {
    const id = await createComplex(slug, slug);
    await makeComplexReady(db.admin, id);
    await publish(id);
    return id;
  };

  describe("создание", () => {
    it("черновик в конце каталога; занятый адрес получает -2", async () => {
      const first = await createComplex("Bahor", "bahor");
      const second = await createComplex("Bahor", "bahor");
      expect((await complexRow(first)).status).toBe("draft");
      expect((await complexRow(second)).slug).toBe("bahor-2");
      expect((await complexRow(second)).sort).toBeGreaterThan((await complexRow(first)).sort);
    });

    it("менеджер, адрес demo-… и застройщик в архиве — отказ", async () => {
      await expectHint(
        db.as(user(manager), (tx) =>
          tx.query("select create_complex($1, $2, 'lola')", [developer, name("Lola")]),
        ),
        "vh:forbidden",
      );
      await expectHint(createComplex("Demo", "demo-zhk"), "vh:slug_reserved");
      const archived = (
        await db.admin.query<{ id: string }>(
          "insert into developers (slug, name, status) values ('old-dev', 'Old', 'archived') returning id",
        )
      ).rows[0]!.id;
      await expectHint(createComplex("Eski", "eski", archived), "vh:developer_archived");
    });
  });

  describe("адрес на сайте", () => {
    const setSlug = (id: string, slug: string) =>
      scalar<string>(head, "select set_complex_slug($1, $2) as value", [id, slug]);

    it("пока ЖК не публиковался — следует за названием; занят — -2; после публикации — нет", async () => {
      const id = await createComplex("Shodlk", "shodlk");
      await createComplex("Shodlik", "shodlik");
      expect(await setSlug(id, "shodlik")).toBe("shodlik-2");
      expect(await setSlug(id, "shodlik")).toBe("shodlik-2");
      await makeComplexReady(db.admin, id);
      await publish(id);
      expect(await setSlug(id, "shodlik-city")).toBe("shodlik-2");
    });

    it("число из прежнего названия не остаётся в адресе, если адрес без него свободен", async () => {
      const id = await createComplex("Lola 2", "lola-2");
      expect(await setSlug(id, "lola")).toBe("lola");
    });

    it("адрес demo-… не выдаётся и не меняется; менеджер — отказ", async () => {
      const id = await createComplex("Orzu Park", "orzu-park");
      expect(await setSlug(id, "demo-orzu")).toBe("orzu-park");
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select set_complex_slug($1, 'x')", [id])),
        "vh:forbidden",
      );
    });
  });

  describe("список", () => {
    it("строки в порядке каталога с застройщиком; видеографу — пусто", async () => {
      const id = await createComplex("Gulzor", "gulzor");
      const rows = await db.as(user(manager), async (tx) =>
        (
          await tx.query<{ id: string; developer_name: string; status: string }>(
            "select id, developer_name, status from complex_rows()",
          )
        ).rows,
      );
      expect(rows.at(-1)).toMatchObject({ id, developer_name: "Zhk Dev", status: "draft" });
      const forVideographer = await db.as(user(videographer), async (tx) =>
        (await tx.query("select id from complex_rows()")).rows,
      );
      expect(forVideographer).toEqual([]);
    });
  });

  describe("готовность и публикация", () => {
    it("у пустого ЖК не выполнено ничего, кроме застройщика; фото считаются", async () => {
      const id = await createComplex("Nur", "nur");
      const rows = await readiness(id);
      expect(rows.map((row) => row.requirement)).toEqual([
        "address",
        "location",
        "point",
        "developer",
        "blocks",
        "layouts",
        "photos",
        "cover",
      ]);
      expect(rows.filter((row) => row.ok).map((row) => row.requirement)).toEqual(["developer"]);
      expect(rows.find((row) => row.requirement === "photos")?.have).toBe(0);
      expect(await readiness(id, videographer)).toHaveLength(8);
    });

    it("не готовый — vh:not_ready со списком; готовый без отметки 1.2 — vh:rule12", async () => {
      const id = await createComplex("Mehr", "mehr");
      await expect(publish(id)).rejects.toMatchObject({ hint: "vh:not_ready", detail: expect.stringContaining("photos") });
      await makeComplexReady(db.admin, id);
      await expectHint(
        asHead((tx) => tx.query("update complexes set status = 'published' where id = $1", [id])),
        "vh:rule12",
      );
      await publish(id);
      expect((await complexRow(id)).status).toBe("published");
    });

    it("после «Скрыть» отметку ставят заново: прошлой мало", async () => {
      const id = await readyPublished("sayhun");
      await asHead((tx) => tx.query("update complexes set status = 'hidden' where id = $1", [id]));
      await expectHint(
        asHead((tx) => tx.query("update complexes set status = 'published' where id = $1", [id])),
        "vh:rule12",
      );
      await publish(id);
    });

    it("опубликованный не теряет готовность; DEMO без фото правится, пока не стало хуже", async () => {
      const id = await readyPublished("dostlik");
      await expectHint(
        asHead((tx) => tx.query("update complexes set address = null where id = $1", [id])),
        "vh:not_ready",
      );
      await expectHint(
        asHead((tx) => tx.query("update complexes set lat = null, lng = null where id = $1", [id])),
        "vh:not_ready",
      );
      const demo = (
        await db.admin.query<{ id: string }>(
          `insert into complexes (developer_id, slug, name, status) values ($1, 'seeded-zhk', $2, 'published')
           returning id`,
          [developer, name("Seeded")],
        )
      ).rows[0]!.id;
      await asHead((tx) =>
        tx.query("update complexes set name = $2 where id = $1", [demo, name("Seeded 2")]),
      );
    });

    it("точка — обе координаты или ни одной; адрес — до 60 знаков", async () => {
      const id = await createComplex("Lola", "lola");
      await expect(
        asHead((tx) => tx.query("update complexes set lat = 40.38 where id = $1", [id])),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        asHead((tx) =>
          tx.query("update complexes set address = $2 where id = $1", [id, name("ул. ".repeat(16))]),
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });

    it("у застройщика в архиве ЖК не восстановить", async () => {
      const owner = (
        await db.admin.query<{ id: string }>(
          "insert into developers (slug, name) values ('arch-dev', 'Arch') returning id",
        )
      ).rows[0]!.id;
      const id = await createComplex("Ipak", "ipak", owner);
      await asHead((tx) => tx.query("update developers set status = 'archived' where id = $1", [owner]));
      expect((await complexRow(id)).status).toBe("archived");
      await expectHint(
        asHead((tx) => tx.query("update complexes set status = 'draft' where id = $1", [id])),
        "vh:developer_archived",
      );
    });
  });

  describe("фото", () => {
    const addPhoto = (complexId: string, width = 2400, rule12 = false, actor = head) =>
      scalar<string>(actor, "select add_complex_photo($1, $2, $3, 1000, null, $4) as value", [
        complexId,
        photoPath(complexId),
        width,
        rule12,
      ]);
    const photoIds = async (complexId: string) =>
      (
        await db.admin.query<{ id: string }>(
          "select id from media_assets where complex_id = $1 and kind = 'photo' order by sort, created_at, id",
          [complexId],
        )
      ).rows.map((row) => row.id);
    const reorder = (complexId: string, ids: string[]) =>
      asHead((tx) => tx.query("select reorder_complex_photos($1, $2)", [complexId, ids]));
    const removePhoto = (complexId: string, id: string) =>
      scalar<string>(head, "select remove_complex_photo($1, $2) as value", [complexId, id]);

    it("новое — в конец; порядок задаёт обложку; удаление отдаёт путь", async () => {
      const id = await createComplex("Zarafshon", "zarafshon");
      const first = await addPhoto(id);
      const second = await addPhoto(id, 1600);
      expect(await photoIds(id)).toEqual([first, second]);
      await reorder(id, [second, first]);
      expect(await photoIds(id)).toEqual([second, first]);
      expect((await readiness(id)).find((row) => row.requirement === "cover")?.ok).toBe(false);
      expect(await removePhoto(id, second)).toMatch(/^complexes\//);
      await expectHint(reorder(id, [first, first]), "vh:invalid");
    });

    it("в опубликованный — только с отметкой 1.2; ниже условий — отказ", async () => {
      const id = await readyPublished("mustaqil");
      await expectHint(addPhoto(id, 2400, false), "vh:rule12");
      await addPhoto(id, 1600, true);
      const ids = await photoIds(id);
      await expectHint(reorder(id, [ids.at(-1)!, ...ids.slice(0, -1)]), "vh:not_ready");
      await removePhoto(id, ids.at(-1)!);
      await expectHint(removePhoto(id, ids[1]!), "vh:not_ready");
    });

    it("не больше 30; менеджер — отказ", async () => {
      const id = await createComplex("Bog", "bog");
      for (let index = 0; index < 30; index += 1) {
        await db.admin.query(
          "insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 1600, 1000)",
          [id, photoPath(id)],
        );
      }
      await expectHint(addPhoto(id), "vh:too_many");
      await expectHint(addPhoto(id, 2400, false, manager), "vh:forbidden");
    });
  });

  describe("блоки", () => {
    const save = (complexId: string, blocks: unknown[], actor = head) =>
      db.as(user(actor), (tx) =>
        tx.query("select save_complex_blocks($1, $2)", [complexId, JSON.stringify(blocks)]),
      );
    const blockRows = async (complexId: string) =>
      (
        await db.admin.query<{ id: string; name: string; deadline_year: number | null }>(
          "select id, name, deadline_year from blocks where complex_id = $1 order by sort",
          [complexId],
        )
      ).rows;

    it("добавление, правка, порядок и удаление одной транзакцией", async () => {
      const id = await createComplex("Navro‘z", "navroz");
      await save(id, [
        { name: "A", floors_total: 12, deadline_year: 2027, deadline_quarter: 4 },
        { name: "B", floors_total: 9, build_status: "delivered", deadline_year: 2025, deadline_quarter: 3 },
      ]);
      const [a, b] = await blockRows(id);
      await save(id, [
        { id: b!.id, name: "B", floors_total: 9 },
        { id: a!.id, name: "A", floors_total: 16, deadline_year: 2028, deadline_quarter: 1 },
      ]);
      expect((await blockRows(id)).map((row) => [row.name, row.deadline_year])).toEqual([
        ["B", null],
        ["A", 2028],
      ]);
      await save(id, [{ id: a!.id, name: "A", floors_total: 16 }, { name: "B", floors_total: 9 }]);
      expect((await blockRows(id)).map((row) => row.name)).toEqual(["A", "B"]);
    });

    it("без этажности, длинное имя и менеджер — отказ", async () => {
      const id = await createComplex("Ko‘k", "kok");
      await expectHint(save(id, [{ name: "A" }]), "vh:invalid");
      await expect(save(id, [{ name: "1-я очередь", floors_total: 9 }])).rejects.toMatchObject({
        code: "23514",
      });
      await expectHint(save(id, [{ name: "A", floors_total: 9 }], manager), "vh:forbidden");
    });

    it("блок со списком квартир не удаляется; у опубликованного — последний со сроком", async () => {
      const id = await readyPublished("chorsu");
      const [block] = await blockRows(id);
      await expectHint(save(id, [{ id: block!.id, name: "R", floors_total: 12 }]), "vh:not_ready");
      await db.admin.query(
        "insert into units (block_id, entrance, floor, position, number) values ($1, 1, 2, 1, '1')",
        [block!.id],
      );
      await expectHint(save(id, []), "vh:has_units");
    });

    it("обмен названиями сохраняется, повтор названия — отказ", async () => {
      const id = await createComplex("Almaz", "almaz");
      await save(id, [
        { name: "1", floors_total: 9 },
        { name: "2", floors_total: 12 },
      ]);
      const [one, two] = await blockRows(id);
      await save(id, [
        { id: one!.id, name: "2", floors_total: 9 },
        { id: two!.id, name: "1", floors_total: 12 },
      ]);
      expect((await blockRows(id)).map((row) => row.name)).toEqual(["2", "1"]);
      await save(id, [
        { name: "A", floors_total: 9 },
        { id: one!.id, name: "B", floors_total: 9 },
        { id: two!.id, name: "1", floors_total: 12 },
      ]);
      expect((await blockRows(id)).map((row) => row.name)).toEqual(["A", "B", "1"]);
      await expect(
        save(id, [
          { name: "C", floors_total: 9 },
          { name: "C", floors_total: 9 },
        ]),
      ).rejects.toMatchObject({ code: "23505" });
    });

    it("этажность не ниже квартир", async () => {
      const id = await createComplex("Baland", "baland");
      await save(id, [{ name: "A", floors_total: 12 }]);
      const [block] = await blockRows(id);
      await db.admin.query(
        "insert into units (block_id, entrance, floor, position, number) values ($1, 1, 12, 1, '121')",
        [block!.id],
      );
      await expectHint(save(id, [{ id: block!.id, name: "A", floors_total: 9 }]), "vh:floors_below_units");
      await save(id, [{ id: block!.id, name: "A", floors_total: 12 }]);
    });

    it("удаление блока отдаёт пути его чертежей и убирает их строки", async () => {
      const id = await createComplex("Chiroq", "chiroq");
      await save(id, [{ name: "A", floors_total: 9 }]);
      const [block] = await blockRows(id);
      const path = drawingPath(id);
      const drawing = await scalar<string>(
        head,
        "select add_complex_drawing($1, $2, 1600, 1200, null, false) as value",
        [id, path],
      );
      await asHead((tx) =>
        tx.query("select save_block_layouts($1, $2)", [
          block!.id,
          JSON.stringify([{ rooms: 1, area: 40, drawing_id: drawing }]),
        ]),
      );
      const removed = await scalar<string[]>(head, "select save_complex_blocks($1, '[]') as value", [id]);
      expect(removed).toEqual([path]);
      const left = await db.admin.query("select id from media_assets where id = $1", [drawing]);
      expect(left.rows).toEqual([]);
    });
  });

  describe("планировки и чертежи", () => {
    let complexId: string;
    let blockId: string;
    const addDrawing = (owner: string, rule12 = false) =>
      scalar<string>(head, "select add_complex_drawing($1, $2, 1600, 1200, null, $3) as value", [
        owner,
        drawingPath(owner),
        rule12,
      ]);
    const save = (layouts: unknown[], block = blockId) =>
      scalar<string[]>(head, "select save_block_layouts($1, $2) as value", [
        block,
        JSON.stringify(layouts),
      ]);
    const layoutRows = async () =>
      (
        await db.admin.query<{ id: string; rooms: number; area: string; drawing_id: string | null }>(
          "select id, rooms, area, drawing_id from layouts where block_id = $1 order by sort",
          [blockId],
        )
      ).rows;

    beforeAll(async () => {
      complexId = await createComplex("Yangi Hayot", "yangi-hayot");
      blockId = (
        await db.admin.query<{ id: string }>(
          "insert into blocks (complex_id, name, floors_total) values ($1, 'A', 12) returning id",
          [complexId],
        )
      ).rows[0]!.id;
    });

    it("порядок — по комнатам и площади; чертёж привязывается; отвязанный возвращается", async () => {
      const first = await addDrawing(complexId);
      expect(await save([{ rooms: 2, area: 64.5 }, { rooms: 1, area: 42.5, drawing_id: first }])).toEqual([]);
      const rows = await layoutRows();
      expect(rows.map((row) => row.rooms)).toEqual([1, 2]);
      expect(rows[0]!.drawing_id).toBe(first);

      const second = await addDrawing(complexId);
      const removed = await save([
        { id: rows[0]!.id, rooms: 1, area: 42.5, drawing_id: second },
        { id: rows[1]!.id, rooms: 2, area: 64.5 },
      ]);
      expect(removed).toHaveLength(1);
      expect(removed[0]).toMatch(/\.png$/);
    });

    it("чертёж чужого ЖК и фото вместо чертежа — отказ", async () => {
      const other = await createComplex("Boshqa", "boshqa");
      const foreign = await addDrawing(other);
      await expectHint(save([{ rooms: 1, area: 40, drawing_id: foreign }]), "vh:invalid");
    });

    it("брошенный чертёж старше суток убирается при сохранении", async () => {
      const stale = await addDrawing(complexId);
      await db.admin.query("update media_assets set created_at = now() - interval '2 days' where id = $1", [stale]);
      const rows = await layoutRows();
      const removed = await save(rows.map((row) => ({ id: row.id, rooms: row.rooms, area: row.area, drawing_id: row.drawing_id })));
      expect(removed).toHaveLength(1);
    });

    it("планировку с квартирами не удалить", async () => {
      const rows = await layoutRows();
      await db.admin.query(
        "insert into units (block_id, layout_id, entrance, floor, position, number) values ($1, $2, 1, 3, 1, '31')",
        [blockId, rows[0]!.id],
      );
      await expectHint(save([{ id: rows[1]!.id, rooms: 2, area: 64.5 }]), "vh:has_units");
    });

    it("в опубликованный ЖК чертёж — только с отметкой 1.2", async () => {
      const id = await readyPublished("qorasuv");
      await expectHint(addDrawing(id), "vh:rule12");
      await addDrawing(id, true);
    });
  });

  describe("журнал ЖК", () => {
    it("фильтр по ЖК, подписи блока и планировки; удаление блока — одна запись", async () => {
      const id = await createComplex("Jurnal", "jurnal");
      await asHead((tx) =>
        tx.query("select save_complex_blocks($1, $2)", [
          id,
          JSON.stringify([{ name: "A", floors_total: 9 }]),
        ]),
      );
      const blockId = (
        await db.admin.query<{ id: string }>("select id from blocks where complex_id = $1", [id])
      ).rows[0]!.id;
      await asHead((tx) =>
        tx.query("select save_block_layouts($1, $2)", [
          blockId,
          JSON.stringify([{ rooms: 2, area: 64.5 }]),
        ]),
      );
      const subjects = async () =>
        asHead(async (tx) =>
          (
            await tx.query<{ entity: string; action: string; subject: string }>(
              "select entity, action, subject from journal_entries(null, null, 50, $1)",
              [id],
            )
          ).rows,
        );
      expect(await subjects()).toEqual(
        expect.arrayContaining([
          { entity: "blocks", action: "insert", subject: "Блок A" },
          { entity: "layouts", action: "insert", subject: "Блок A · 2-комн. · 64,5 м²" },
          { entity: "complexes", action: "insert", subject: "Jurnal" },
        ]),
      );

      await asHead((tx) => tx.query("select save_complex_blocks($1, '[]')", [id]));
      const deletes = (await subjects()).filter((row) => row.action === "delete");
      expect(deletes).toEqual([{ entity: "blocks", action: "delete", subject: "Блок A" }]);
      // Каскад не оставляет и «ничьих» записей (без ЖК) — их не видно ни в одном журнале.
      const orphans = await db.admin.query(
        "select id from audit_log where entity = 'layouts' and action = 'delete' and complex_id is null",
      );
      expect(orphans.rows).toEqual([]);
    });

    it("порядок планировок не шумит в журнале; правка удалённой планировки сохраняет подпись", async () => {
      const id = await createComplex("Tartib", "tartib");
      await asHead((tx) =>
        tx.query("select save_complex_blocks($1, $2)", [id, JSON.stringify([{ name: "A", floors_total: 9 }])]),
      );
      const blockId = (
        await db.admin.query<{ id: string }>("select id from blocks where complex_id = $1", [id])
      ).rows[0]!.id;
      const saveLayouts = (layouts: unknown[]) =>
        asHead((tx) => tx.query("select save_block_layouts($1, $2)", [blockId, JSON.stringify(layouts)]));
      const entries = async () =>
        asHead(async (tx) =>
          (
            await tx.query<{ entity: string; action: string; subject: string }>(
              "select entity, action, subject from journal_entries(null, null, 50, $1)",
              [id],
            )
          ).rows.filter((row) => row.entity === "layouts"),
        );

      await saveLayouts([{ rooms: 2, area: 64.5 }]);
      const big = (
        await db.admin.query<{ id: string }>("select id from layouts where block_id = $1", [blockId])
      ).rows[0]!.id;
      await saveLayouts([{ id: big, rooms: 2, area: 64.5 }, { rooms: 1, area: 40 }]);
      expect((await entries()).map((row) => row.action)).toEqual(["insert", "insert"]);

      await saveLayouts([{ id: big, rooms: 2, area: 64.5, price_from: 35000 }]);
      await saveLayouts([]);
      const update = (await entries()).find((row) => row.action === "update");
      expect(update?.subject).toBe("Блок A · 2-комн. · 64,5 м²");
      // Удалён и сам блок — подпись из записи (название блока сохранено контекстом).
      await asHead((tx) => tx.query("select save_complex_blocks($1, '[]')", [id]));
      expect((await entries()).find((row) => row.action === "update")?.subject).toBe(
        "Блок A · 2-комн. · 64,5 м²",
      );
    });

    it("удаление блока с чертежами — одна запись о блоке, без «Фото · удалено»", async () => {
      const id = await createComplex("Chizma", "chizma");
      await asHead((tx) =>
        tx.query("select save_complex_blocks($1, $2)", [id, JSON.stringify([{ name: "A", floors_total: 9 }])]),
      );
      const blockId = (
        await db.admin.query<{ id: string }>("select id from blocks where complex_id = $1", [id])
      ).rows[0]!.id;
      const drawing = await scalar<string>(
        head,
        "select add_complex_drawing($1, $2, 1600, 1200, null, false) as value",
        [id, drawingPath(id)],
      );
      await asHead((tx) =>
        tx.query("select save_block_layouts($1, $2)", [
          blockId,
          JSON.stringify([{ rooms: 1, area: 40, drawing_id: drawing }]),
        ]),
      );
      await asHead((tx) => tx.query("select save_complex_blocks($1, '[]')", [id]));
      const rows = await asHead(async (tx) =>
        (
          await tx.query<{ entity: string; action: string }>(
            "select entity, action from journal_entries(null, null, 50, $1)",
            [id],
          )
        ).rows,
      );
      expect(rows.filter((row) => row.action === "delete")).toEqual([
        { entity: "blocks", action: "delete" },
      ]);
      expect(rows.some((row) => row.entity === "media_assets")).toBe(false);
    });
  });

  describe("логотип опубликованного застройщика", () => {
    it("загрузка — только с отметкой 1.2", async () => {
      const path = `developers/${developer}/${crypto.randomUUID()}.png`;
      await expectHint(
        asHead((tx) =>
          tx.query("select set_developer_media($1, 'logo', $2, 400, 400, null)", [developer, path]),
        ),
        "vh:rule12",
      );
      await asHead((tx) =>
        tx.query("select set_developer_media($1, 'logo', $2, 400, 400, null, 0.5, 0.5, true)", [
          developer,
          path,
        ]),
      );
    });
  });
});
