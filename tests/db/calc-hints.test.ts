import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CALC_HINT_DRAFTS, CALC_HINT_SLUGS, calcHintsFrom } from "@/lib/calc/hints";
import { anon, createTestDb, isRemoteTarget, type TestDb } from "./harness";

// Шаг 2.8: подсказки «?» калькулятора — справочник hints. Миграция заводит ровно набор из кода
// с теми же черновиками (их показывают стенды); посетитель читает только включённые.

describe.skipIf(isRemoteTarget)("подсказки «?» калькулятора", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(() => db.close());

  const visible = async () => {
    const { rows } = await db.as(anon, (tx) =>
      tx.query<{ slug: string; term: unknown; text: unknown }>(
        "select slug, term, text from hints order by slug",
      ),
    );
    return rows;
  };

  it("миграция заводит набор из кода с теми же текстами, что у стендов", async () => {
    const hints = calcHintsFrom(await visible());
    expect(Object.keys(hints).sort()).toEqual([...CALC_HINT_SLUGS].sort());
    expect(hints).toEqual(CALC_HINT_DRAFTS);
  });

  it("выключенную подсказку посетитель не видит — «?» у термина пропадает", async () => {
    await db.admin.query("update hints set is_active = false where slug = 'overpayment'");
    const slugs = (await visible()).map((row) => row.slug);
    expect(slugs).not.toContain("overpayment");
    expect(slugs).toContain("down-payment");
  });
});
