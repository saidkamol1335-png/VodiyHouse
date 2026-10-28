import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, isRemoteTarget, service, user, type TestDb } from "./harness";

// Шаг 3.16б: витрина на сайте (миграция 20261028180000_site_showcase.sql) на DEMO-сиде —
// site_showcase() ролью посетителя (только действующее, ЖК только опубликованные), напоминание за
// 3 дня без повтора (take_showcase_reminders), события ad_view / ad_click и лента «Сейчас на сайте».

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

type Text = { ru: string; uz: string };
type Showcase = {
  today: string;
  collections: { slug: string; mode: string; complex_ids: string[]; filter: Record<string, string>; cover: unknown }[];
  specials: { id: string; kind: string; title: Text; developer: { slug: string }; complex_ids: string[]; valid_to: string; cover: unknown }[];
  ads: { id: string; title: Text; developer: { slug: string }; complex_ids: string[]; filter: Record<string, string> }[];
};
type Reminder = { kind: string; id: string; title: Text; developer: string; valid_to: string };

describe.skipIf(isRemoteTarget)("витрина на сайте: site_showcase(), напоминания и события рекламы", () => {
  let db: TestDb;
  const showcase = async () =>
    (await db.as(anon, (tx) => tx.query<{ data: Showcase }>("select site_showcase() as data"))).rows[0]!.data;
  const reminders = async () =>
    (await db.as(service, (tx) => tx.query<{ data: Reminder[] }>("select take_showcase_reminders() as data"))).rows[0]!.data;
  const complexId = async (slug: string) =>
    (await db.admin.query<{ id: string }>("select id from complexes where slug = $1", [slug])).rows[0]!.id;

  beforeAll(async () => {
    db = await createTestDb();
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("посетитель видит действующее по порядку руководителя: 3 спецпредложения, 1 реклама, 5 подборок", async () => {
    const data = await showcase();
    expect(data.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.specials.map((special) => special.title.ru)).toEqual([
      "Кухонный гарнитур в подарок",
      "Рассрочка на 24 месяца без наценки",
      "Первый взнос от 20% через банк-партнёр",
    ]);
    expect(data.specials[0]).toMatchObject({ kind: "gift", developer: { slug: "demo-sifat" }, cover: null });
    expect(data.specials[0]!.complex_ids).toEqual([await complexId("demo-shodlik")]);
    expect(data.ads.map((ad) => ad.title.ru)).toEqual(["Готовые 2-комнатные квартиры в рассрочку"]);
    expect(data.ads[0]).toMatchObject({ complex_ids: [], filter: { komnat: "2", srok: "built" } });
    expect(data.collections.map((collection) => collection.slug)).toEqual([
      "demo-sdannye-doma",
      "demo-rassrochka-cherez-bank",
      "demo-do-45000",
      "demo-tsentr-fergany",
      "demo-studii-i-1-komnatnye",
    ]);
    expect(data.collections[3]!.complex_ids).toEqual([await complexId("demo-namuna"), await complexId("demo-yulduz")]);
  });

  it("напоминание за 3 дня — один раз на запись и дату конца; продлили — напомнит снова; только серверу", async () => {
    await expectDenied(db.as(anon, (tx) => tx.query("select take_showcase_reminders()")));
    const head = await createStaff(db.admin, "head");
    await expectDenied(db.as(user(head), (tx) => tx.query("select take_showcase_reminders()")));
    expect(await reminders()).toEqual([]);
    await db.admin.query(
      `update specials set valid_to = private.tashkent_today() + 2 where title ->> 'ru' = 'Кухонный гарнитур в подарок'`,
    );
    await db.admin.query(`update ads set valid_to = private.tashkent_today() + 3 where title ->> 'ru' like 'Готовые 2-комнатные%'`);
    // Выключенная запись не напоминает: её и так нет на сайте.
    await db.admin.query(
      `update ads set valid_from = private.tashkent_today() - 1, valid_to = private.tashkent_today() + 1, is_active = false
       where title ->> 'ru' like 'Orzu:%'`,
    );
    const due = await reminders();
    expect(due.map((item) => [item.kind, item.title.ru, item.developer])).toEqual([
      ["special", "Кухонный гарнитур в подарок", "Farg‘ona Sifat Qurilish"],
      ["ad", "Готовые 2-комнатные квартиры в рассрочку", "Farg‘ona Sifat Qurilish"],
    ]);
    expect(await reminders()).toEqual([]);
    await db.admin.query(`update specials set valid_to = private.tashkent_today() + 30 where title ->> 'ru' = 'Кухонный гарнитур в подарок'`);
    expect(await reminders()).toEqual([]);
    await db.admin.query(`update specials set valid_to = private.tashkent_today() + 1 where title ->> 'ru' = 'Кухонный гарнитур в подарок'`);
    expect((await reminders()).map((item) => item.title.ru)).toEqual(["Кухонный гарнитур в подарок"]);
    // Запись удалили — её отметки убираются при следующем обходе.
    await db.admin.query(`delete from specials where title ->> 'ru' = 'Кухонный гарнитур в подарок'`);
    await reminders();
    const left = await db.admin.query<{ kind: string }>("select kind from showcase_notices");
    expect(left.rows.map((row) => row.kind)).toEqual(["ad"]);
  });

  it("ad_view и ad_click пишутся с объектом «реклама»; в ленте кабинета — только клик, с заголовком", async () => {
    const ad = (await db.admin.query<{ id: string }>("select id from ads order by sort limit 1")).rows[0]!.id;
    const visitor = crypto.randomUUID();
    const written = await db.as(service, async (tx) =>
      (await tx.query<{ v: number }>("select track_events($1, $2, null, 'desktop', 'ru', null, $3::jsonb) as v", [
        visitor,
        crypto.randomUUID(),
        JSON.stringify([
          { type: "ad_view", path: "/ru", entity_type: "ad", entity_id: ad },
          { type: "ad_click", path: "/ru", entity_type: "ad", entity_id: ad },
          { type: "ad_click", path: "/ru", entity_type: "ad", entity_id: "не-uuid" },
        ]),
      ])).rows[0]!.v,
    );
    expect(written).toBe(3);
    const rows = await db.admin.query<{ type: string; entity_type: string | null; entity_id: string | null }>(
      "select type, entity_type, entity_id from events where visitor_id = $1 order by id",
      [visitor],
    );
    expect(rows.rows).toEqual([
      { type: "ad_view", entity_type: "ad", entity_id: ad },
      { type: "ad_click", entity_type: "ad", entity_id: ad },
      { type: "ad_click", entity_type: null, entity_id: null },
    ]);
    const manager = await createStaff(db.admin, "manager");
    const feed = await db.as(user(manager), async (tx) =>
      (await tx.query<{ v: { feed: { type: string; ad: Text | null }[] } }>("select site_now() as v")).rows[0]!.v.feed,
    );
    expect(feed.some((item) => item.type === "ad_view")).toBe(false);
    expect(feed.find((item) => item.type === "ad_click" && item.ad)?.ad?.ru).toBe("Готовые 2-комнатные квартиры в рассрочку");
  });

  // Последним: обратно не публикуем (публикация ЖК и застройщика проверяет готовность, у DEMO её нет).
  it("ЖК не на сайте уходит из списков, выключенная подборка и застройщик-черновик — не видны", async () => {
    await db.admin.query("update complexes set status = 'hidden' where slug = 'demo-yulduz'");
    await db.admin.query("update collections set is_active = false where slug = 'demo-do-45000'");
    await db.admin.query("update developers set status = 'draft' where slug = 'demo-kamalak'");
    const data = await showcase();
    expect(data.collections.map((collection) => collection.slug)).not.toContain("demo-do-45000");
    expect(data.collections.find((collection) => collection.slug === "demo-tsentr-fergany")!.complex_ids).toEqual([
      await complexId("demo-namuna"),
    ]);
    const installment = data.specials.find((special) => special.title.ru.startsWith("Рассрочка на 24"))!;
    expect(installment.complex_ids).toEqual([await complexId("demo-namuna")]);
    expect(data.specials.map((special) => special.developer.slug)).not.toContain("demo-kamalak");
  });
});
