import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anon, createStaff, createTestDb, expectDenied, user, type TestDb } from "./harness";

// «Biz haqimizda» (20261117120000, правки 15.11 п. 25): «Tarix» и «Jamoa» — публичные записи settings
// site.about_history и site.about_team, правит руководитель, формат проверяет база; сотрудник — только
// с отметкой согласия; фото команды — папка team/<id сотрудника>/ бакета media (загружает руководитель).

const MEMBER = crypto.randomUUID();
const PHOTO = `team/${MEMBER}/${crypto.randomUUID()}.jpg`;
const EVENT = { year: 2019, title: { ru: "Открыли офис в Фергане", uz: "Farg‘onada ofis ochdik" }, text: null };
const PERSON = {
  id: MEMBER,
  name: "Азиз Каримов",
  position: { ru: "Руководитель отдела продаж", uz: "Sotuv bo‘limi rahbari" },
  photo: { path: PHOTO, width: 1600, height: 2000, blur: null },
  consent_at: "2026-11-17T10:00:00Z",
};

describe("«О компании»: история и команда", () => {
  let db: TestDb;
  let head: string;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const save = (who: string, key: string, value: unknown) =>
    db.as(user(who), (tx) =>
      tx.query(
        `insert into settings (key, value, is_public) values ($1, $2::jsonb, true)
           on conflict (key) do update set value = excluded.value`,
        [key, JSON.stringify(value)],
      ),
    );

  it("руководитель сохраняет историю; кривой год и пустой заголовок база не примет", async () => {
    await save(head, "site.about_history", [EVENT, { ...EVENT, year: 2024, text: { ru: "Пятый ЖК", uz: "Beshinchi TJM" } }]);
    await expect(save(head, "site.about_history", [{ ...EVENT, year: 1800 }])).rejects.toThrow(/settings_about_history_valid/);
    await expect(save(head, "site.about_history", [{ ...EVENT, title: { ru: "", uz: "x" } }])).rejects.toThrow(/settings_about_history_valid/);
  });

  it("сотрудник — только с отметкой согласия и фото из своей папки", async () => {
    await save(head, "site.about_team", [PERSON, { ...PERSON, id: crypto.randomUUID(), photo: null }]);
    // Без отметки согласия (consent_at пропадает из JSON) — отказ.
    await expect(save(head, "site.about_team", [{ ...PERSON, consent_at: undefined }])).rejects.toThrow(/settings_about_team_valid/);
    await expect(save(head, "site.about_team", [{ ...PERSON, photo: { ...PERSON.photo, path: `team/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg` } }])).rejects.toThrow(/settings_about_team_valid/);
  });

  it("менеджер не правит; сайт читает обе записи через public_settings", async () => {
    await expectDenied(save(manager, "site.about_team", [PERSON]));
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ key: string }>("select key from public_settings where key in ('site.about_history', 'site.about_team') order by key"),
    );
    expect(rows.map((row) => row.key)).toEqual(["site.about_history", "site.about_team"]);
  });

  it("фото команды загружает руководитель; менеджер и посетитель — нет", async () => {
    const upload = (who: Parameters<typeof db.as>[0], name: string) =>
      db.as(who, (tx) => tx.query("insert into storage.objects (bucket_id, name) values ('media', $1)", [name]));
    await upload(user(head), PHOTO);
    await expectDenied(upload(user(manager), `team/${MEMBER}/${crypto.randomUUID()}.jpg`));
    await expectDenied(upload(anon, `team/${MEMBER}/${crypto.randomUUID()}.jpg`));
  });
});
