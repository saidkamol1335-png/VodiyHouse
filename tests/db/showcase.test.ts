import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import {
  anon,
  createStaff,
  createTestDb,
  expectDenied,
  expectHint,
  isRemoteTarget,
  user,
  type Actor,
  type Db,
  type TestDb,
} from "./harness";

// Шаг 3.16а: «Витрина» в базе (миграция 20261028150000_showcase.sql) — права руководителя, что
// видит сайт, запрет «скидка», ЖК своего застройщика, уборка при удалении ЖК, обложки с отметкой
// правила 1.2, DEMO-сид и его удаление, журнал.

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");
const readDemo = (file: string) => readFile(path.join(DEMO_DIR, file), "utf8");

const text = (ru: string, uz = ru) => JSON.stringify({ ru, uz });

type SpecialOverrides = {
  developer?: string;
  complexes?: string[];
  title?: string;
  badge?: string;
  active?: boolean;
  toDays?: number;
};

describe("витрина: права, правила и DEMO", () => {
  let db: TestDb;
  let ids: ContentIds;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    head = await createStaff(db.admin, "head", { fullName: "Бахтиёр Каримов" });
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const asHead = <T>(run: (tx: Db) => Promise<T>) => db.as(user(head), run);

  const insertSpecial = (actor: Actor, overrides: SpecialOverrides = {}) =>
    db.as(actor, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into specials (developer_id, kind, badge, title, complex_ids, valid_from, valid_to, is_active)
         values ($1, 'gift', $2, $3, $4, current_date - 1, current_date + $5::integer, $6) returning id`,
        [
          overrides.developer ?? ids.publicDeveloper,
          text(overrides.badge ?? "Подарок", "Sovg‘a"),
          text(overrides.title ?? "Кухня в подарок", "Oshxona sovg‘a"),
          overrides.complexes ?? [ids.publicComplex],
          overrides.toDays ?? 10,
          overrides.active ?? true,
        ],
      );
      return rows[0]!.id;
    });

  const count = async (actor: Actor, table: string) =>
    (await db.as(actor, (tx) => tx.query<{ n: number }>(`select count(*)::int as n from ${table}`))).rows[0]!.n;

  describe("права и видимость", () => {
    it("добавляет руководитель; менеджер и посетитель — отказ, чужая правка — ноль строк", async () => {
      const id = await insertSpecial(user(head));
      await expectDenied(insertSpecial(user(manager)));
      await expectDenied(insertSpecial(anon));
      const changed = await db.as(user(manager), (tx) =>
        tx.query("update specials set sort = 5 where id = $1", [id]),
      );
      expect(changed.affectedRows ?? 0).toBe(0);
      await asHead((tx) => tx.query("delete from specials where id = $1", [id]));
    });

    it("посетитель видит только включённое в периоде у опубликованного застройщика; сотрудники — всё", async () => {
      const visible = await insertSpecial(user(head));
      await insertSpecial(user(head), { toDays: -1, title: "Истекло" });
      await insertSpecial(user(head), { active: false, title: "Выключено" });
      await insertSpecial(user(head), {
        developer: ids.draftDeveloper,
        complexes: [ids.orphanComplex],
        title: "Черновик застройщика",
      });
      const seen = await db.as(anon, (tx) => tx.query<{ id: string }>("select id from specials"));
      expect(seen.rows.map((row) => row.id)).toEqual([visible]);
      expect(await count(user(manager), "specials")).toBe(4);
      await asHead((tx) => tx.query("delete from specials"));
    });

    it("подборка: посетитель видит включённые, адрес уникален", async () => {
      const insert = (slug: string, active: boolean) =>
        asHead((tx) =>
          tx.query(
            `insert into collections (slug, title, mode, filter, is_active) values ($1, $2, 'filter', '{"srok": "built"}', $3)`,
            [slug, text("Сданные дома", "Topshirilgan uylar"), active],
          ),
        );
      // В облаке рядом живут подборки DEMO-сида — считаем относительно того, что уже есть.
      const visibleBefore = await count(anon, "collections");
      const allBefore = await count(user(manager), "collections");
      await insert("sdannye-doma", true);
      await insert("skrytaya", false);
      expect(await count(anon, "collections")).toBe(visibleBefore + 1);
      expect(await count(user(manager), "collections")).toBe(allBefore + 2);
      await expect(insert("sdannye-doma", true)).rejects.toMatchObject({ code: "23505" });
      await asHead((tx) => tx.query("delete from collections where slug in ('sdannye-doma', 'skrytaya')"));
    });
  });

  describe("правила", () => {
    it("«скидка / chegirma» в тексте — отказ базы (на сайте скидок нет)", async () => {
      await expect(insertSpecial(user(head), { title: "Скидка 15% при 100% оплате" })).rejects.toThrow(
        /violates check constraint/,
      );
      // «−N%» — тоже скидка (ревью блока G, миграция 20261028230000); «взнос 30%» проходит.
      await expect(insertSpecial(user(head), { title: "−10% на все квартиры" })).rejects.toThrow(/violates check constraint/);
      await expect(insertSpecial(user(head), { title: "Первый взнос 10–30%, остальное в рассрочку" })).resolves.toBeTruthy();
      await expect(insertSpecial(user(head), { title: "Цена —10% до пятницы" })).rejects.toThrow(/violates check constraint/);
      // Удачная вставка не должна жить дальше теста: DEMO-подсчёт ниже ждёт свои четыре.
      await db.admin.query("delete from specials where title ->> 'ru' like 'Первый взнос 10–30%%'");
      await expect(
        asHead((tx) =>
          tx.query("insert into collections (slug, title, mode, filter) values ('chegirma', $1, 'filter', '{\"srok\": \"built\"}')", [
            text("Дома", "15% chegirma"),
          ]),
        ),
      ).rejects.toThrow(/violates check constraint/);
    });

    it("ЖК чужого застройщика или несуществующий — vh:invalid; повторы схлопываются", async () => {
      await expectHint(insertSpecial(user(head), { complexes: [ids.orphanComplex] }), "vh:invalid");
      await expectHint(insertSpecial(user(head), { complexes: [crypto.randomUUID()] }), "vh:invalid");
      const id = await insertSpecial(user(head), { complexes: [ids.publicComplex, ids.publicComplex, ids.draftComplex] });
      const { rows } = await db.admin.query<{ complex_ids: string[] }>("select complex_ids from specials where id = $1", [id]);
      expect(rows[0]!.complex_ids).toEqual([ids.publicComplex, ids.draftComplex]);
      await asHead((tx) => tx.query("delete from specials"));
    });

    it("удалённый ЖК уходит из массивов спецпредложений, рекламы и подборок", async () => {
      const complexId = (
        await db.admin.query<{ id: string }>(
          `insert into complexes (developer_id, slug, name, status) values ($1, 'vremennyy', $2, 'draft') returning id`,
          [ids.publicDeveloper, text("Временный")],
        )
      ).rows[0]!.id;
      const special = await insertSpecial(user(head), { complexes: [ids.publicComplex, complexId] });
      await asHead((tx) =>
        tx.query(
          `insert into ads (developer_id, title, complex_ids, valid_to) values ($1, $2, $3, current_date + 5)`,
          [ids.publicDeveloper, text("Реклама", "Reklama"), [complexId]],
        ),
      );
      await db.admin.query("delete from complexes where id = $1", [complexId]);
      const left = await db.admin.query<{ complex_ids: string[] }>("select complex_ids from specials where id = $1", [special]);
      expect(left.rows[0]!.complex_ids).toEqual([ids.publicComplex]);
      const ad = await db.admin.query<{ complex_ids: string[] }>("select complex_ids from ads");
      expect(ad.rows[0]!.complex_ids).toEqual([]);
      await asHead((tx) => tx.exec("delete from ads; delete from specials"));
    });
  });

  describe("обложки", () => {
    const setCover = (actor: Actor, id: string, filePath: string, rule12: boolean) =>
      db.as(actor, (tx) =>
        tx.query<{ old: string | null }>(
          "select set_showcase_media('special', $1, $2, 2400, 1350, null, 0.5, 0.5, $3) as old",
          [id, filePath, rule12],
        ),
      );
    const coverPath = (id: string) => `specials/${id}/${crypto.randomUUID()}.jpg`;

    it("только руководитель, только с отметкой 1.2; одна на владельца, старый путь возвращается", async () => {
      const id = await insertSpecial(user(head));
      await expectHint(setCover(user(head), id, coverPath(id), false), "vh:rule12");
      await expectHint(setCover(user(manager), id, coverPath(id), true), "vh:forbidden");
      const first = coverPath(id);
      expect((await setCover(user(head), id, first, true)).rows[0]!.old).toBeNull();
      expect((await setCover(user(head), id, coverPath(id), true)).rows[0]!.old).toBe(first);
      const covers = await db.admin.query("select path from media_assets where special_id = $1", [id]);
      expect(covers.rows).toHaveLength(1);
      await expectHint(setCover(user(head), crypto.randomUUID(), coverPath(id), true), "vh:not_found");
      const removed = await asHead((tx) =>
        tx.query<{ old: string | null }>("select remove_showcase_media('special', $1) as old", [id]),
      );
      expect(removed.rows[0]!.old).toMatch(/^specials\//);
      await asHead((tx) => tx.query("delete from specials where id = $1", [id]));
    });

    it("путь — в папке владельца; политика Storage пускает только папку существующей записи", async () => {
      const id = await insertSpecial(user(head));
      await expect(setCover(user(head), id, `specials/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`, true)).rejects.toThrow(
        /path_in_owner_folder/,
      );
      const upload = (name: string) =>
        asHead((tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [name]));
      await upload(coverPath(id));
      await expectDenied(upload(`specials/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`));
      await expectDenied(upload(`ads/${id}/${crypto.randomUUID()}.jpg`));
      await asHead((tx) => tx.query("delete from specials where id = $1", [id]));
    });
  });

  describe("журнал", () => {
    it("запись витрины — заголовком; спецпредложение — в журнале застройщика", async () => {
      const id = await insertSpecial(user(head), { title: "Кухня в подарок" });
      const entries = await asHead((tx) =>
        tx.query<{ entity: string; subject: string | null }>(
          "select entity, subject from journal_entries(p_developer => $1) where entity = 'specials'",
          [ids.publicDeveloper],
        ),
      );
      expect(entries.rows[0]).toEqual({ entity: "specials", subject: "Кухня в подарок" });
      await asHead((tx) => tx.query("delete from specials where id = $1", [id]));
      const gone = await asHead((tx) =>
        tx.query<{ subject: string | null }>(
          "select subject from journal_entries(p_developer => $1) where entity = 'specials' order by id desc limit 1",
          [ids.publicDeveloper],
        ),
      );
      expect(gone.rows[0]!.subject).toBe("Кухня в подарок");
    });
  });

  describe.skipIf(isRemoteTarget)("DEMO", () => {
    const demoCounts = async () => ({
      specials: await count(anon, "specials"),
      ads: await count(anon, "ads"),
      collections: await count(anon, "collections"),
      staffSpecials: await count(user(head), "specials"),
      staffAds: await count(user(head), "ads"),
    });

    it("сид: 4 спецпредложения (3 идут, «Старт продаж» ждёт), 2 рекламы (одна идёт), 5 подборок; remove убирает всё", async () => {
      await db.admin.exec(await readDemo("remove.sql"));
      await db.admin.exec(await readDemo("seed.sql"));
      expect(await demoCounts()).toEqual({ specials: 3, ads: 1, collections: 5, staffSpecials: 4, staffAds: 2 });
      const manual = await db.admin.query<{ n: number }>(
        "select cardinality(complex_ids) as n from collections where slug = 'demo-tsentr-fergany'",
      );
      expect(manual.rows[0]!.n).toBe(2);
      await db.admin.exec(await readDemo("remove.sql"));
      expect(await demoCounts()).toEqual({ specials: 0, ads: 0, collections: 0, staffSpecials: 0, staffAds: 0 });
    });
  });
});
