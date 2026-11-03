import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedContent, type ContentIds } from "./content-fixtures";
import { anon, createStaff, createTestDb, isRemoteTarget, user, type TestDb } from "./harness";

// «Частые вопросы» ЖК (20261103120000, PLAN §10 п. 21): правят руководитель и менеджер, формат
// проверяет база; сайт видит вопросы только у ЖК, который можно смотреть.

const PAIR = { q: { ru: "Есть ли парковка?", uz: "Avtoturargoh bormi?" }, a: { ru: "Да, подземная.", uz: "Ha, yer osti." } };

describe.skipIf(isRemoteTarget)("частые вопросы ЖК", () => {
  let db: TestDb;
  let ids: ContentIds;
  let manager: string;

  beforeAll(async () => {
    db = await createTestDb();
    ids = await seedContent(db.admin);
    manager = await createStaff(db.admin, "manager");
  });
  afterAll(() => db.close());

  const save = (faq: unknown, complex = ids.draftComplex) =>
    db.as(user(manager), (tx) => tx.query("update complexes set faq = $2::jsonb where id = $1", [complex, JSON.stringify(faq)]));
  const read = async (complex: string) =>
    (await db.as(anon, (tx) => tx.query<{ v: unknown }>("select site_complex_faq($1) as v", [complex]))).rows[0]!.v;

  it("менеджер сохраняет до 8 пар на двух языках; кривой формат база не примет", async () => {
    await save([PAIR]);
    await expect(save([{ ...PAIR, q: { ru: "Только ру" } }])).rejects.toThrow(/complexes_faq_valid/);
    await expect(save(Array.from({ length: 9 }, () => PAIR))).rejects.toThrow(/complexes_faq_valid/);
    await expect(save([{ ...PAIR, a: { ru: "x".repeat(601), uz: "y" } }])).rejects.toThrow(/complexes_faq_valid/);
    await expect(save([{ ...PAIR, extra: 1 }])).rejects.toThrow(/complexes_faq_valid/);
  });

  it("сайт видит вопросы опубликованного ЖК, черновика — нет", async () => {
    await save([PAIR], ids.publicComplex);
    await save([PAIR], ids.draftComplex);
    expect(await read(ids.publicComplex)).toEqual([PAIR]);
    expect(await read(ids.draftComplex)).toBeNull();
    expect(await read(ids.orphanComplex)).toBeNull();
  });
});
