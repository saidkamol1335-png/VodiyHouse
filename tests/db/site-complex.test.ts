import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectHint, isRemoteTarget, user, type Db, type TestDb } from "./harness";

// Шаг 3.5: страница ЖК — site_complex(slug) на DEMO-сиде и функции новых вкладок кабинета
// (миграция 20261025180000_complex_page.sql): документы, видео, детали, перенос срока, «Удобство
// локации». Сайт — без полей сотрудников и скидок (PLAN §3.13).

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Offer = { rooms: number; free: number | null };
type Block = {
  id: string;
  name: string;
  free: number | null;
  offers: Offer[];
  deadline_history: {
    from_year: number;
    from_quarter: number;
    to_year: number;
    to_quarter: number;
  }[];
  finishing: { slug: string; description: { ru: string } | null };
  price_includes: unknown[];
};
type Layout = {
  block_id: string;
  rooms: number;
  area: number;
  free: number | null;
  floor_from: number | null;
  floor_to: number | null;
  drawing: unknown;
};
type Page = {
  complex: {
    id: string;
    slug: string;
    status: string;
    nearby: unknown[];
    checked: Record<string, string | null>;
    stock_updated_at: string | null;
  };
  developer: {
    name: string;
    complexes_built: number;
    complexes_building: number;
    programs: { type: string }[];
  };
  photos: unknown[];
  blocks: Block[];
  layouts: Layout[];
  documents: { slug: string; hint: { ru: string } | null; checked_on: string }[];
  videos: { youtube_id: string }[];
  details: { slug: string; text: { ru: string } }[];
  others: { slug: string }[];
};

describe.skipIf(isRemoteTarget)("страница ЖК: site_complex() и вкладки кабинета", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  const page = async (slug: string, actor = anon) =>
    (await db.as(actor, (tx) => tx.query<{ data: Page | null }>("select site_complex($1) as data", [slug]))).rows[0]!.data;
  const complexId = async (slug: string) => (await db.admin.query<{ id: string }>("select id from complexes where slug = $1", [slug])).rows[0]!.id;
  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  it("Shodlik как в мокапе: блоки, свободно 12 / 29, перенос «2 кв. → 4 кв. 2027», 6 документов", async () => {
    const data = (await page("demo-shodlik"))!;
    expect(data.complex.slug).toBe("demo-shodlik");
    const [blockA, blockB] = data.blocks;
    expect([blockA!.free, blockB!.free]).toEqual([12, 29]);
    expect(blockA!.offers.map((o) => [o.rooms, o.free])).toEqual([
      [1, 4],
      [2, 6],
      [3, 2],
    ]);
    expect(blockB!.deadline_history).toEqual([{ from_year: 2027, from_quarter: 2, to_year: 2027, to_quarter: 4, changed_on: "2026-08-20" }]);
    expect(blockA!.deadline_history).toEqual([]);
    expect(blockA!.finishing.description?.ru).toMatch(/оштукатурены/);
    expect(data.documents.map((d) => d.slug)).toEqual(["land", "permit", "declaration", "expertise", "seismic", "commissioning"]);
    expect(data.documents.every((d) => d.checked_on === "2026-09-12" && d.hint?.ru)).toBe(true);
    expect(data.complex.checked).toEqual({
      permit: "2026-09-12",
      land: "2026-09-12",
      visit: "2026-09-20",
    });
    expect(data.complex.nearby).toHaveLength(6);
    expect(data.complex.stock_updated_at).not.toBeNull();
  });

  it("планировки: «осталось N» и этажи по квартирам; застройщик — счётчики по ЖК на сайте", async () => {
    const data = (await page("demo-shodlik"))!;
    expect(data.layouts).toHaveLength(8);
    const first = data.layouts[0]!;
    expect(first).toMatchObject({ rooms: 1, floor_from: 2, floor_to: 12 });
    expect(data.layouts.reduce((sum, layout) => sum + (layout.free ?? 0), 0)).toBe(41);
    // Sifat на сайте — только Shodlik: блок B строится.
    expect(data.developer).toMatchObject({
      name: "Farg‘ona Sifat Qurilish",
      complexes_built: 0,
      complexes_building: 1,
    });
    expect(data.developer.programs.length).toBeGreaterThan(0);
    expect(data.others).toEqual([]);
    expect((await page("demo-namuna"))!.others.map((o) => o.slug)).toEqual(["demo-yulduz"]);
  });

  it("Namuna — разделы сверх мокапа: «Детали проекта» и «Что входит в цену»; видео нет", async () => {
    const data = (await page("demo-namuna"))!;
    expect(data.details.map((d) => d.slug)).toEqual(["about", "quality", "landscaping"]);
    expect(data.blocks[0]!.price_includes).toHaveLength(4);
    expect(data.videos).toEqual([]);
    expect(data.documents.map((d) => d.slug)).not.toContain("commissioning");
  });

  it("без полей сотрудников и скидок; черновик и чужой адрес посетителю — null, сотруднику — предпросмотр", async () => {
    const text = JSON.stringify(await page("demo-shodlik"));
    for (const hidden of ["discount_pct", "developer_private", "notes", "contacts", "updated_by", "files_checked_at"]) {
      expect(text).not.toContain(hidden);
    }
    expect(await page("no-such-zhk")).toBeNull();
    await db.admin.query(
      `insert into complexes (developer_id, slug, name)
       select id, 'zhk-draft', '{"ru": "Черновик", "uz": "Qoralama"}' from developers where slug = 'demo-sifat'`,
    );
    expect(await page("zhk-draft")).toBeNull();
    expect((await page("zhk-draft", user(head)))?.complex.status).toBe("draft");
  });

  it("документы: сохраняются целиком, без шума в журнале; будущая дата и менеджер — отказ", async () => {
    const id = await complexId("demo-yulduz");
    const types = (await db.admin.query<{ id: number; slug: string }>("select id, slug from document_types order by sort")).rows;
    const typeId = (slug: string) => types.find((t) => t.slug === slug)!.id;
    const save = (docs: unknown, actor = head) => db.as(user(actor), (tx) => tx.query("select save_complex_documents($1, $2)", [id, JSON.stringify(docs)]));
    const journal = async () =>
      Number((await db.admin.query<{ n: string }>("select count(*) as n from audit_log where entity = 'complex_documents'")).rows[0]!.n);
    const before = await journal();
    await save([
      { type_id: typeId("permit"), checked_on: "2026-09-11" },
      { type_id: typeId("land"), checked_on: "2026-09-11" },
    ]);
    // Разрешение и земля — те же даты: изменений нет; остальные три удалены.
    expect((await journal()) - before).toBe(3);
    expect((await page("demo-yulduz"))!.documents.map((d) => d.slug)).toEqual(["land", "permit"]);
    await expectHint(save([{ type_id: typeId("permit"), checked_on: "2999-01-01" }]), "vh:future_date");
    await expectHint(save([{ type_id: 32000, checked_on: "2026-01-01" }]), "vh:invalid");
    await expectHint(save([{ type_id: "x", checked_on: "2026-01-01" }]), "vh:invalid");
    await expectHint(save([], manager), "vh:forbidden");
  });

  it("видео и детали: порядок, правка, удаление; фото детали — только из галереи этого ЖК", async () => {
    const id = await complexId("demo-yulduz");
    const topics = (await db.admin.query<{ id: number }>("select id from detail_topics order by sort")).rows;
    await asHead((tx) =>
      tx.query("select save_complex_videos($1, $2)", [
        id,
        JSON.stringify([
          { youtube_id: "aaaaaaaaaaa", title: { ru: "Обзор", uz: "Sharh" } },
          { youtube_id: "bbbbbbbbbbb", title: null },
        ]),
      ]),
    );
    await asHead((tx) => tx.query("select save_complex_videos($1, $2)", [id, JSON.stringify([{ youtube_id: "bbbbbbbbbbb" }, { youtube_id: "aaaaaaaaaaa" }])]));
    expect((await page("demo-yulduz"))!.videos.map((v) => v.youtube_id)).toEqual(["bbbbbbbbbbb", "aaaaaaaaaaa"]);
    // Неверный код ролика ловит проверка таблицы.
    await expect(asHead((tx) => tx.query("select save_complex_videos($1, $2)", [id, JSON.stringify([{ youtube_id: "short" }])]))).rejects.toThrow(/youtube_id/);
    await asHead((tx) =>
      tx.query("select save_complex_details($1, $2)", [
        id,
        JSON.stringify([
          { topic_id: topics[1]!.id, text: { ru: "Качество", uz: "Sifat" } },
          { topic_id: topics[0]!.id, text: { ru: "О проекте", uz: "Loyiha haqida" } },
        ]),
      ]),
    );
    // Порядок на сайте — по справочнику тем, а не по вводу.
    expect((await page("demo-yulduz"))!.details.map((d) => d.text.ru)).toEqual(["О проекте", "Качество"]);
    const orzu = await complexId("demo-orzu");
    const foreignPhoto = (
      await db.admin.query<{ id: string }>("insert into media_assets (complex_id, kind, path, width, height) values ($1, 'photo', $2, 10, 10) returning id", [
        orzu,
        `complexes/${orzu}/${crypto.randomUUID()}.jpg`,
      ])
    ).rows[0]!.id;
    await expectHint(
      asHead((tx) =>
        tx.query("select save_complex_details($1, $2)", [
          id,
          JSON.stringify([{ topic_id: topics[0]!.id, text: { ru: "a", uz: "b" }, photo_id: foreignPhoto }]),
        ]),
      ),
      "vh:invalid",
    );
  });

  it("перенос срока: «Сохранить» с отметкой пишет историю, без отметки — нет; запись убирается", async () => {
    const id = await complexId("demo-yulduz");
    const blocks = (
      await db.admin.query<Record<string, unknown>>(
        "select id, name, build_status, progress_pct, floors_total, floors_built, deadline_year, deadline_quarter, finishing_id, cadastre, currency, price_includes from blocks where complex_id = $1 order by sort",
        [id],
      )
    ).rows;
    const save = (patch: Record<string, unknown>) =>
      asHead((tx) => tx.query("select save_complex_blocks($1, $2)", [id, JSON.stringify(blocks.map((b) => ({ ...b, ...patch })))]));
    await save({ deadline_year: 2027, deadline_quarter: 4, deadline_shift: false });
    await save({ deadline_year: 2028, deadline_quarter: 1, deadline_shift: true });
    const history = (await page("demo-yulduz"))!.blocks[0]!.deadline_history;
    expect(history).toEqual([
      {
        from_year: 2027,
        from_quarter: 4,
        to_year: 2028,
        to_quarter: 1,
        changed_on: expect.any(String),
      },
    ]);
    const change = (await db.admin.query<{ id: string }>("select id from deadline_changes where complex_id = $1", [id])).rows[0]!.id;
    await expectHint(
      db.as(user(manager), (tx) => tx.query("select remove_deadline_change($1)", [change])),
      "vh:forbidden",
    );
    const owner = await asHead((tx) => tx.query<{ owner: string }>("select remove_deadline_change($1) as owner", [change]));
    expect(owner.rows[0]!.owner).toBe(id);
    expect((await page("demo-yulduz"))!.blocks[0]!.deadline_history).toEqual([]);
  });

  it("журнал: документ и тема — названием справочника, видео — подписью, перенос — блоком; во всём журнале — с ЖК", async () => {
    const id = await complexId("demo-yulduz");
    const entries = async (complex: string | null) =>
      (
        await asHead((tx) =>
          tx.query<{ entity: string; action: string; subject: string }>("select entity, action, subject from journal_entries(null, null, 200, $1)", [complex]),
        )
      ).rows.filter((row) => ["complex_documents", "complex_details", "complex_videos", "deadline_changes"].includes(row.entity));
    const blockName = (await db.admin.query<{ name: string }>("select name from blocks where complex_id = $1 order by sort limit 1", [id])).rows[0]!.name;
    expect(await entries(id)).toEqual(
      expect.arrayContaining([
        { entity: "complex_documents", action: "delete", subject: "Проектная декларация" },
        // Подпись — нынешняя: второе сохранение её сняло, остался id ролика.
        { entity: "complex_videos", action: "insert", subject: "aaaaaaaaaaa" },
        { entity: "complex_videos", action: "update", subject: "bbbbbbbbbbb" },
        { entity: "complex_details", action: "insert", subject: "О проекте" },
        { entity: "deadline_changes", action: "delete", subject: `Блок ${blockName}` },
      ]),
    );
    const name = (await db.admin.query<{ name: string }>("select name ->> 'ru' as name from complexes where id = $1", [id])).rows[0]!.name;
    const everywhere = await entries(null);
    expect(everywhere.length).toBeGreaterThan(0);
    expect(everywhere.filter((row) => !row.subject.startsWith(`${name} · `))).toEqual([]);
  });

  it("порядок каталога (3.6): руководитель переставляет опубликованные; неполный список и менеджер — отказ", async () => {
    const published = (await db.admin.query<{ id: string }>("select id from complexes where status = 'published' order by sort, name ->> 'ru'")).rows.map((r) => r.id);
    expect(published.length).toBeGreaterThan(1);
    const reorder = (ids: string[], actor = head) => db.as(user(actor), (tx) => tx.query("select reorder_complexes($1)", [ids]));
    const reversed = [...published].reverse();
    await reorder(reversed);
    const catalog = (await db.as(anon, (tx) => tx.query<{ data: { complexes: { id: string }[] } }>("select site_catalog() as data"))).rows[0]!.data;
    expect(catalog.complexes.map((c) => c.id)).toEqual(reversed);
    await expectHint(reorder(reversed.slice(1)), "vh:invalid");
    await expectHint(reorder([...reversed.slice(1), reversed[1]!]), "vh:invalid");
    await expectHint(reorder(published, manager), "vh:forbidden");
  });

  it("«Удобство локации»: неверный вид, пустое название или без расстояния — отказ базы", async () => {
    const id = await complexId("demo-yulduz");
    const set = (nearby: unknown) => asHead((tx) => tx.query("update complexes set nearby = $2 where id = $1", [id, JSON.stringify(nearby)]));
    const place = {
      kind: "school",
      name: { ru: "Школа №1", uz: "1-maktab" },
      meters: 300,
      minutes: 4,
    };
    await set([place, { ...place, kind: "park", mode: "car", meters: undefined }]);
    for (const wrong of [
      [{ ...place, kind: "zoo" }],
      [{ ...place, name: { ru: "", uz: "x" } }],
      [{ kind: "school", name: place.name }],
      [{ ...place, meters: "300" }],
      [{ ...place, extra: 1 }],
      Array.from({ length: 13 }, () => place),
    ]) {
      await expect(set(wrong)).rejects.toThrow(/complexes_nearby_valid/);
    }
  });
});
