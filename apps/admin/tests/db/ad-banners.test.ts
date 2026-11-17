import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, expectHint, user, type TestDb } from "./harness";

// Реклама — баннер (20261117130000_ad_banner_kinds.sql, 20261117140000_ad_banners.sql; правки 15.11,
// п. 4 + 13): кнопка cta, картинки banner и banner_mobile — только у рекламы, по одной каждого вида,
// руководитель и с отметкой правила 1.2; заявка типа ad.

describe("реклама — баннер", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let ad: string;
  let developer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    developer = (
      await db.admin.query<{ id: string }>("insert into developers (slug, name, status) values ('ad-dev', 'Ad Dev', 'published') returning id")
    ).rows[0]!.id;
    ad = (
      await db.admin.query<{ id: string }>(
        `insert into ads (developer_id, title, valid_to) values ($1, '{"ru": "Старт продаж", "uz": "Sotuv boshlandi"}', current_date + 10) returning id`,
        [developer],
      )
    ).rows[0]!.id;
  });
  afterAll(() => db.close());

  const setBanner = (who: string, kind: string, owner = "ad", id = ad, rule12 = true) =>
    db.as(user(who), (tx) =>
      tx.query<{ old: string | null }>(
        "select set_showcase_media($1, $2, $3, 2400, 800, null, 0.5, 0.5, $4, $5) as old",
        [owner, id, `${owner === "ad" ? "ads" : "specials"}/${id}/${crypto.randomUUID()}.jpg`, rule12, kind],
      ),
    );

  it("кнопка — phone или lead; по умолчанию — заявка", async () => {
    expect((await db.admin.query<{ cta: string }>("select cta from ads where id = $1", [ad])).rows[0]!.cta).toBe("lead");
    await expect(db.admin.query("update ads set cta = 'site' where id = $1", [ad])).rejects.toThrow(/check/);
  });

  it("баннер для ПК и для телефона: один каждого вида, старый путь возвращается; без 1.2 и не руководителю — нет", async () => {
    expect((await setBanner(head, "banner")).rows[0]!.old).toBeNull();
    expect((await setBanner(head, "banner")).rows[0]!.old).toMatch(/^ads\//);
    expect((await setBanner(head, "banner_mobile")).rows[0]!.old).toBeNull();
    const kinds = await db.admin.query<{ kind: string }>("select kind::text from media_assets where ad_id = $1 order by kind", [ad]);
    expect(kinds.rows.map((row) => row.kind)).toEqual(["banner", "banner_mobile"]);
    await expectHint(setBanner(head, "banner", "ad", ad, false), "vh:rule12");
    await expectHint(setBanner(manager, "banner"), "vh:forbidden");
    await expectHint(setBanner(head, "photo"), "vh:invalid");
    const removed = await db.as(user(head), (tx) =>
      tx.query<{ old: string | null }>("select remove_showcase_media('ad', $1, 'banner_mobile') as old", [ad]),
    );
    expect(removed.rows[0]!.old).toMatch(/^ads\//);
  });

  it("баннер — только у рекламы: у спецпредложения база откажет", async () => {
    await expectHint(setBanner(head, "banner", "special", crypto.randomUUID()), "vh:invalid");
    const special = (
      await db.admin.query<{ id: string }>(
        `insert into specials (developer_id, kind, badge, title, valid_to)
           values ($1, 'gift', '{"ru": "Подарок", "uz": "Sovg‘a"}', '{"ru": "Кухня", "uz": "Oshxona"}', current_date + 5) returning id`,
        [developer],
      )
    ).rows[0]!.id;
    await expect(
      db.admin.query("insert into media_assets (special_id, kind, path, width, height) values ($1, 'banner', $2, 2400, 800)", [
        special,
        `specials/${special}/${crypto.randomUUID()}.jpg`,
      ]),
    ).rejects.toThrow(/media_assets_kind_by_owner/);
  });

  it("скидки: пока выключатель выключен, site_showcase() не отдаёт спецпредложение со скидкой (20261117150000)", async () => {
    await db.admin.query(
      `insert into specials (developer_id, kind, badge, title, valid_to, is_active) values
         ($1, 'gift', '{"ru": "Скидка 5%", "uz": "5% chegirma"}', '{"ru": "Скидка на старте", "uz": "Chegirma"}', current_date + 5, true),
         ($1, 'gift', '{"ru": "Подарок", "uz": "Sovg‘a"}', '{"ru": "Кухня в подарок", "uz": "Oshxona sovg‘a"}', current_date + 5, true)`,
      [developer],
    );
    const titles = async () =>
      (
        await db.as(anon, (tx) => tx.query<{ v: { title: { ru: string } }[] }>("select site_showcase() -> 'specials' as v"))
      ).rows[0]!.v.map((special) => special.title.ru);
    expect(await titles()).toEqual(["Кухня в подарок"]);
    await db.admin.query(`insert into settings (key, value, is_public) values ('site.show_discounts', '{"enabled": true}', true)`);
    expect((await titles()).sort()).toEqual(["Кухня в подарок", "Скидка на старте"]);
    await db.admin.query("delete from settings where key = 'site.show_discounts'");
  });

  it("заявка типа ad есть в enum; менеджер настройки скидок не правит", async () => {
    const types = await db.admin.query<{ v: string }>("select unnest(enum_range(null::lead_type))::text as v");
    expect(types.rows.map((row) => row.v)).toContain("ad");
    await expectDenied(
      db.as(user(manager), (tx) =>
        tx.query(`insert into settings (key, value, is_public) values ('site.show_discounts', '{"enabled": true}', true)`),
      ),
    );
  });
});
