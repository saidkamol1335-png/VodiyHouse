import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_PROGRAMS_SCREEN } from "@/lib/admin/programs/demo";
import { panelsFrom, type PanelRecord } from "@/lib/admin/programs/panels";
import type { ProgramPanel } from "@/lib/admin/programs/types";
import { createStaff, createTestDb, isRemoteTarget, user, type TestDb } from "./harness";

// Стенд /dev/programmy показывает то же, что payment_program_panels() по DEMO-сиду: те же
// программы, блоки и цена «Примера» (id у стенда свои — сравниваем по смыслу).

const DEMO_DIR = path.resolve(import.meta.dirname, "../../supabase/demo");

function comparable(panels: readonly ProgramPanel[]) {
  return panels.map((panel) => {
    const blockName = new Map(
      panel.blocks.map((block) => [block.id, `${block.complexName.ru} ${block.name}`]),
    );
    return {
      slug: panel.slug,
      name: panel.name,
      complexes: panel.complexes,
      blocks: panel.blocks.map((block) => blockName.get(block.id)),
      priceHint: panel.priceHint,
      programs: panel.programs.map(({ kind, bankName, isActive, record }) => ({
        kind,
        bank: bankName?.ru ?? null,
        isActive,
        sort: record.sort,
        method: record.method,
        discount: record.discount_pct === null ? null : Number(record.discount_pct),
        minDown: record.min_down_pct === null ? null : Number(record.min_down_pct),
        tiers: record.tiers,
        terms: record.terms,
        fees: record.fees,
        presets: record.preset_months,
        custom: record.allow_custom_months,
        overMax: record.over_max_behavior,
        currency: record.currency,
        scope: record.blocks_scope,
        blocks: record.block_ids.map((id) => blockName.get(id)),
      })),
    };
  });
}

describe.skipIf(isRemoteTarget)("DEMO программ оплаты: стенд = сид", () => {
  let db: TestDb;
  let head: string;

  beforeAll(async () => {
    db = await createTestDb();
    head = await createStaff(db.admin, "head");
    await db.admin.exec(await readFile(path.join(DEMO_DIR, "seed.sql"), "utf8"));
  });
  afterAll(() => db.close());

  it("панели, программы, блоки и цена «Примера» совпадают", async () => {
    const { rows } = await db.as(user(head), (tx) =>
      tx.query<{ data: PanelRecord[] }>("select payment_program_panels() as data"),
    );
    expect(comparable(DEMO_PROGRAMS_SCREEN.panels)).toEqual(comparable(panelsFrom(rows[0]!.data)));
  });
});
