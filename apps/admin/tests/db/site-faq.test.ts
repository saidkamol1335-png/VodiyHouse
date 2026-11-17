import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, user, type TestDb } from "./harness";

// Общие частые вопросы Vodiy House (20261117100000, правки 15.11 п. 7 + 23): запись site.faq правят
// руководитель и менеджер, формат — как у вопросов ЖК (valid_faq), сайт читает через public_settings;
// мобилографу запись закрыта.

const PAIR = { q: { ru: "Как вы зарабатываете?", uz: "Qanday daromad qilasiz?" }, a: { ru: "Комиссию платит застройщик.", uz: "Komissiyani quruvchi to‘laydi." } };

describe("общие частые вопросы", () => {
  let db: TestDb;
  let head: string;
  let manager: string;
  let mobilographer: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
    mobilographer = await createStaff(db.admin, "mobilographer");
  });
  afterAll(() => db.close());

  const upsert = (value: unknown, isPublic = true) => ({
    text: `insert into settings (key, value, is_public) values ('site.faq', $1::jsonb, $2)
             on conflict (key) do update set value = excluded.value, is_public = excluded.is_public`,
    values: [JSON.stringify(value), isPublic],
  });
  const save = (who: string, value: unknown, isPublic = true) => {
    const query = upsert(value, isPublic);
    return db.as(user(who), (tx) => tx.query(query.text, query.values));
  };

  it("менеджер и руководитель сохраняют до 8 пар; кривой формат база не примет", async () => {
    await save(manager, [PAIR]);
    await save(head, [PAIR, PAIR]);
    await expect(save(manager, [{ ...PAIR, q: { ru: "Только ру" } }])).rejects.toThrow(/settings_site_faq_valid/);
    await expect(save(manager, Array.from({ length: 9 }, () => PAIR))).rejects.toThrow(/settings_site_faq_valid/);
    await expect(save(head, { q: PAIR.q })).rejects.toThrow(/settings_site_faq_valid/);
  });

  it("менеджер не делает запись закрытой; мобилограф не правит", async () => {
    await expectDenied(save(manager, [PAIR], false));
    await expectDenied(save(mobilographer, [PAIR]));
  });

  it("сайт читает вопросы через public_settings", async () => {
    await save(manager, [PAIR]);
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ value: unknown }>("select value from public_settings where key = 'site.faq'"),
    );
    expect(rows[0]?.value).toEqual([PAIR]);
  });
});
