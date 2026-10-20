import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStaff, createTestDb, expectHint, user, type Db, type TestDb } from "./harness";

type ProjectRow = {
  id: string;
  name: { ru: string; uz: string };
  planned_on: string | null;
  delivered_on: string | null;
  sort: number;
};

const ABOUT = { ru: "Строит с 2012 года", uz: "2012 yildan beri quradi" };
const name = (ru: string, uz = ru) => ({ ru, uz });

// Шаг 10.2: кабинет застройщиков и справочников (миграция 20261020150000_developers_admin.sql).
describe("кабинет застройщиков", () => {
  let db: TestDb;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head", { fullName: "Бахтиёр Каримов" });
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);
  const createDeveloper = async (title: string, slug: string) =>
    asHead(async (tx) => {
      const { rows } = await tx.query<{ id: string }>("select create_developer($1, $2) as id", [
        title,
        slug,
      ]);
      return rows[0]!.id;
    });
  const developerRow = async (id: string) =>
    (
      await db.admin.query<{ slug: string; status: string; sort: number }>(
        "select slug, status, sort from developers where id = $1",
        [id],
      )
    ).rows[0]!;
  const addLogo = (developerId: string) =>
    db.admin.query(
      "insert into media_assets (developer_id, kind, path, width, height) values ($1, 'logo', $2, 400, 400)",
      [developerId, `developers/${developerId}/${crypto.randomUUID()}.png`],
    );

  describe("создание", () => {
    it("руководитель создаёт черновик в конце списка; занятый адрес получает -2, -3", async () => {
      const first = await createDeveloper("Sifat Qurilish", "sifat-qurilish");
      const second = await createDeveloper("Sifat Qurilish", "sifat-qurilish");
      const third = await createDeveloper("Sifat Qurilish", "sifat-qurilish");
      expect((await developerRow(first)).status).toBe("draft");
      expect([(await developerRow(second)).slug, (await developerRow(third)).slug]).toEqual([
        "sifat-qurilish-2",
        "sifat-qurilish-3",
      ]);
      expect((await developerRow(second)).sort).toBeGreaterThan((await developerRow(first)).sort);
    });

    it("менеджер — отказ; адрес demo-… занят DEMO-данными", async () => {
      await expectHint(
        db.as(user(manager), (tx) => tx.query("select create_developer('Yangi', 'yangi')")),
        "vh:forbidden",
      );
      await expectHint(createDeveloper("Demo Qurilish", "demo-qurilish"), "vh:slug_reserved");
    });
  });

  describe("публикация", () => {
    const publish = (id: string) =>
      asHead((tx) => tx.query("update developers set status = 'published' where id = $1", [id]));

    it("без «О компании» или без логотипа — отказ; с ними — опубликован", async () => {
      const id = await createDeveloper("Marg‘ilon Invest", "margilon-invest");
      await expectHint(publish(id), "vh:not_ready");
      await asHead((tx) =>
        tx.query("update developers set about = $2 where id = $1", [id, JSON.stringify(ABOUT)]),
      );
      await expectHint(publish(id), "vh:not_ready");
      await addLogo(id);
      await publish(id);
      expect((await developerRow(id)).status).toBe("published");
    });

    it("скрыть и вернуть в черновик можно без проверки; DEMO вставляется опубликованным", async () => {
      const id = await createDeveloper("Kamalak", "kamalak");
      await asHead((tx) => tx.query("update developers set status = 'hidden' where id = $1", [id]));
      expect((await developerRow(id)).status).toBe("hidden");
      await db.admin.query(
        "insert into developers (slug, name, status) values ('seeded', 'Seeded', 'published')",
      );
    });
  });

  describe("сданные объекты", () => {
    let developer: string;
    const save = (projects: unknown, actor = head) =>
      db.as(user(actor), (tx) =>
        tx.query("select save_developer_past_projects($1, $2)", [
          developer,
          JSON.stringify(projects),
        ]),
      );
    const projects = async () =>
      (
        await db.admin.query<ProjectRow>(
          "select id, name, planned_on::text, delivered_on::text, sort from developer_past_projects where developer_id = $1 order by sort",
          [developer],
        )
      ).rows;

    beforeAll(async () => {
      developer = await createDeveloper("Navro‘z Qurilish", "navroz-qurilish");
    });

    it("вкладка сохраняется целиком: новые, правка, удаление и порядок — одной транзакцией", async () => {
      await save([
        { name: name("Дом 1", "1-uy"), planned_on: "2021-06-30", delivered_on: "2021-06-30" },
        { name: name("Дом 2", "2-uy"), planned_on: "2022-12-31", delivered_on: null },
      ]);
      const [one, two] = await projects();
      expect([one!.sort, two!.sort]).toEqual([10, 20]);

      await save([
        {
          id: two!.id,
          name: name("Дом 2", "2-uy"),
          planned_on: "2022-12-31",
          delivered_on: "2023-03-31",
        },
        { name: name("Дом 3", "3-uy"), planned_on: null, delivered_on: "2024-09-30" },
      ]);
      const after = await projects();
      expect(after.map((row) => row.name.ru)).toEqual(["Дом 2", "Дом 3"]);
      expect(after[0]).toMatchObject({ id: two!.id, delivered_on: "2023-03-31", sort: 10 });
    });

    it("ошибка в одной строке — не меняется ничего", async () => {
      const before = await projects();
      await expect(
        save([
          {
            id: before[0]!.id,
            name: name("Переименован", "Yangi nom"),
            planned_on: null,
            delivered_on: null,
          },
          { name: { ru: "Без узбекского", uz: "" }, planned_on: null, delivered_on: null },
        ]),
      ).rejects.toThrow();
      expect(await projects()).toEqual(before);
    });

    it("чужой или удалённый объект — «не найден»; больше 50 — отказ; менеджер — отказ", async () => {
      const other = await createDeveloper("Boshqa", "boshqa");
      const foreign = await asHead(async (tx) => {
        await tx.query("select save_developer_past_projects($1, $2)", [
          other,
          JSON.stringify([{ name: name("Чужой"), planned_on: null, delivered_on: null }]),
        ]);
        return (
          await tx.query<{ id: string }>(
            "select id from developer_past_projects where developer_id = $1",
            [other],
          )
        ).rows[0]!.id;
      });
      await expectHint(
        save([{ id: foreign, name: name("Захват"), planned_on: null, delivered_on: null }]),
        "vh:not_found",
      );
      const many = Array.from({ length: 51 }, (_, index) => ({
        name: name(`Дом ${index}`),
        planned_on: null,
        delivered_on: null,
      }));
      await expectHint(save(many), "vh:invalid");
      await expectHint(save([], manager), "vh:forbidden");
    });

    it("журнал: только изменённые строки, с застройщиком и автором", async () => {
      const current = await projects();
      const { rows: before } = await db.admin.query<{ count: number }>(
        "select count(*)::int as count from audit_log",
      );
      await save(
        current.map(({ id, name: title, planned_on, delivered_on }) => ({
          id,
          name: title,
          planned_on,
          delivered_on,
        })),
      );
      const { rows: after } = await db.admin.query<{ count: number }>(
        "select count(*)::int as count from audit_log",
      );
      expect(after[0]!.count).toBe(before[0]!.count);

      await save([
        ...current.map(({ id, name: title, planned_on, delivered_on }) => ({
          id,
          name: title,
          planned_on,
          delivered_on,
        })),
        { name: name("Дом 4", "4-uy"), planned_on: null, delivered_on: null },
      ]);
      const { rows } = await db.admin.query<{
        developer_id: string;
        actor_id: string;
        action: string;
      }>(
        "select developer_id, actor_id, action from audit_log where entity = 'developer_past_projects' order by id desc limit 1",
      );
      expect(rows[0]).toEqual({ developer_id: developer, actor_id: head, action: "insert" });
    });
  });

  describe("список и журнал", () => {
    let developer: string;

    beforeAll(async () => {
      developer = await createDeveloper("Orzu Development", "orzu-development");
      await addLogo(developer);
      const complex = (slug: string, status: string) =>
        db.admin.query(
          "insert into complexes (developer_id, slug, name, status) values ($1, $2, jsonb_build_object('ru', $2::text, 'uz', $2::text), $3)",
          [developer, slug, status],
        );
      await complex("orzu-1", "published");
      await complex("orzu-2", "draft");
      await complex("orzu-3", "archived");
      await asHead(async (tx) => {
        await tx.query("update developers set founded_year = 2015 where id = $1", [developer]);
        await tx.query(
          "insert into developer_private (developer_id, contacts) values ($1, 'Отдел продаж')",
          [developer],
        );
        await tx.query("update complexes set status = 'hidden' where slug = 'orzu-1'");
      });
    });

    it("строки списка: «N ЖК» без архивных и логотип; менеджеру — пусто", async () => {
      const { rows } = await asHead((tx) =>
        tx.query<{ id: string; complexes: number; logo_path: string | null }>(
          "select id, complexes, logo_path from developer_rows()",
        ),
      );
      const row = rows.find((item) => item.id === developer);
      expect(row?.complexes).toBe(2);
      expect(row?.logo_path).toMatch(new RegExp(`^developers/${developer}/`));
      const forManager = await db.as(user(manager), (tx) =>
        tx.query("select * from developer_rows()"),
      );
      expect(forManager.rows).toEqual([]);
    });

    it("журнал застройщика: его строки, внутреннее и логотип, без ЖК; автор по имени; страницы", async () => {
      const { rows } = await asHead((tx) =>
        tx.query<{ id: number; entity: string; actor_name: string | null }>(
          "select id, entity, actor_name from journal_entries($1)",
          [developer],
        ),
      );
      expect(new Set(rows.map((row) => row.entity))).toEqual(
        new Set(["developers", "developer_private", "media_assets"]),
      );
      expect(
        rows
          .filter((row) => row.entity === "developer_private")
          .every((row) => row.actor_name === "Бахтиёр Каримов"),
      ).toBe(true);

      const ids = rows.map((row) => row.id);
      const page = await asHead((tx) =>
        tx.query<{ id: number }>("select id from journal_entries($1, $2, 1)", [developer, ids[0]]),
      );
      expect(page.rows.map((row) => row.id)).toEqual([ids[1]]);
    });

    it("о ком запись: застройщик по текущему названию, удалённое значение — по своему", async () => {
      const { rows } = await asHead((tx) =>
        tx.query<{ subject: string | null }>("select subject from journal_entries($1)", [
          developer,
        ]),
      );
      expect(new Set(rows.map((row) => row.subject))).toEqual(new Set(["Orzu Development"]));

      await asHead((tx) => tx.query("delete from detail_topics where slug = 'quality'"));
      const { rows: all } = await asHead((tx) =>
        tx.query<{ entity: string; subject: string | null }>(
          "select entity, subject from journal_entries(null, null, 1)",
        ),
      );
      expect(all[0]).toEqual({ entity: "detail_topics", subject: "Качество и стиль" });
    });

    it("весь журнал видит менеджер; видеограф — нет", async () => {
      const videographer = await createStaff(db.admin, "videographer");
      const forManager = await db.as(user(manager), (tx) =>
        tx.query("select id from journal_entries()"),
      );
      expect(forManager.rows.length).toBeGreaterThan(0);
      const forVideographer = await db.as(user(videographer), (tx) =>
        tx.query("select id from journal_entries()"),
      );
      expect(forVideographer.rows).toEqual([]);
    });
  });
});

describe("справочники в кабинете", () => {
  let db: TestDb;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const sortOf = async (table: string) =>
    (
      await db.admin.query<{ id: number; sort: number }>(
        `select id, sort from ${table} order by sort, id`,
      )
    ).rows;
  const remove = (dictionary: string, id: number, actor = head) =>
    db.as(
      user(actor),
      async (tx) =>
        (
          await tx.query<{ result: string }>("select remove_dictionary_item($1, $2) as result", [
            dictionary,
            id,
          ])
        ).rows[0]!.result,
    );

  it("порядок перетаскиванием: новые sort по списку; менеджер и чужая таблица — отказ", async () => {
    const before = await sortOf("detail_topics");
    const reversed = before.map((row) => row.id).reverse();
    await db.as(user(head), (tx) =>
      tx.query("select reorder_dictionary('detail_topics', $1)", [reversed]),
    );
    expect((await sortOf("detail_topics")).map((row) => row.id)).toEqual(reversed);
    await expectHint(
      db.as(user(manager), (tx) =>
        tx.query("select reorder_dictionary('detail_topics', $1)", [reversed]),
      ),
      "vh:forbidden",
    );
    await expectHint(
      db.as(user(head), (tx) => tx.query("select reorder_dictionary('profiles', $1)", [reversed])),
      "vh:invalid",
    );
  });

  it("неиспользуемое удаляется, используемое — скрывается", async () => {
    const { rows: topics } = await db.admin.query<{ id: number }>(
      "select id from detail_topics order by id limit 1",
    );
    expect(await remove("detail_topics", topics[0]!.id)).toBe("deleted");

    const { rows: fergana } = await db.admin.query<{ id: number }>(
      "select id from locations where slug = 'fergana'",
    );
    const developer = await db.admin.query<{ id: string }>(
      "insert into developers (slug, name) values ('loc-dev', 'Loc Dev') returning id",
    );
    await db.admin.query(
      'insert into complexes (developer_id, slug, name, location_id) values ($1, \'loc-zhk\', \'{"ru": "ЖК", "uz": "TJM"}\', $2)',
      [developer.rows[0]!.id, fergana[0]!.id],
    );
    expect(await remove("locations", fergana[0]!.id)).toBe("hidden");
    const { rows } = await db.admin.query<{ is_active: boolean }>(
      "select is_active from locations where id = $1",
      [fergana[0]!.id],
    );
    expect(rows[0]!.is_active).toBe(false);
  });

  it("нет значения — «не найдено»; менеджер — отказ", async () => {
    await expectHint(remove("finishings", 9999), "vh:not_found");
    const { rows } = await db.admin.query<{ id: number }>(
      "select id from finishings order by id limit 1",
    );
    await expectHint(remove("finishings", rows[0]!.id, manager), "vh:forbidden");
  });
});
