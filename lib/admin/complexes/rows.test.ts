import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BLOCK_LIMITS, blockDraftsFrom, newBlockDraft, type BlockDraft } from "./blocks";
import { parseBlocks } from "./blocksParse";
import {
  LAYOUT_LIMITS,
  newLayoutDraft,
  parseLayouts,
  sortLayouts,
  type LayoutDraft,
} from "./layouts";

const migration = (file: string) =>
  readFileSync(path.resolve(import.meta.dirname, "../../../supabase/migrations", file), "utf8");

const formWith = (name: string, value: unknown) => {
  const data = new FormData();
  data.append(name, JSON.stringify(value));
  return data;
};

const block = (patch: Partial<BlockDraft>): BlockDraft => ({
  ...newBlockDraft(),
  name: "A",
  floorsTotal: "12",
  ...patch,
});
const layout = (patch: Partial<LayoutDraft>): LayoutDraft => ({
  ...newLayoutDraft(),
  rooms: 1,
  area: "42,5",
  ...patch,
});

describe("«Блоки» (И4)", () => {
  it("пределы — как check в миграциях", () => {
    expect(migration("20261021090000_complexes_admin.sql")).toContain(
      `length(btrim(name)) between 1 and ${BLOCK_LIMITS.nameMax}`,
    );
    expect(migration("20261019170100_blocks_layouts_units.sql")).toContain(
      `floors_total between 1 and ${BLOCK_LIMITS.floorsMax}`,
    );
  });

  it("срок — квартал и год; у сданного нет «построено» и %; кадастр «ожидается» — только при «оформляется»", () => {
    const parsed = parseBlocks(
      formWith("blocks", [
        block({ deadline: "2027-12-31", floorsBuilt: "7", progressPct: "58", finishingId: "3" }),
        block({
          name: "B",
          buildStatus: "delivered",
          floorsBuilt: "12",
          progressPct: "100",
          cadastre: "done",
          cadastreExpectedOn: "2027-03-31",
        }),
      ]),
    );
    expect(parsed).toMatchObject({
      ok: true,
      payload: [
        {
          name: "A",
          deadline_year: 2027,
          deadline_quarter: 4,
          floors_built: 7,
          progress_pct: 58,
          finishing_id: 3,
        },
        {
          name: "B",
          build_status: "delivered",
          floors_built: null,
          progress_pct: null,
          cadastre_expected_on: null,
        },
      ],
    });
  });

  it("ошибки по карточке; «что входит в цену» с контактами — отказ; битый JSON — invalid", () => {
    const bad = block({ key: "k1", name: "1-я очередь", floorsTotal: "", floorsBuilt: "5" });
    const withPhone = block({
      key: "k2",
      priceIncludes: [
        {
          key: "i1",
          item: { ru: "кладовая +998 90 123 45 67", uz: "ombor" },
          included: true,
          price: "",
        },
      ],
    });
    expect(parseBlocks(formWith("blocks", [bad, withPhone]))).toMatchObject({
      ok: false,
      rowErrors: {
        k1: { name: "nameTooLong", floorsTotal: "floorsRequired" },
        k2: { priceIncludes: "contacts" },
      },
    });
    expect(parseBlocks(formWith("blocks", [{ ...bad, buildStatus: "ruins" }]))).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(
      parseBlocks(
        formWith(
          "blocks",
          Array.from({ length: 21 }, () => block({})),
        ),
      ),
    ).toEqual({
      ok: false,
      error: "tooMany",
    });
  });

  it("из базы: срок — последний день квартала, квартиры и цены планировок — только чтение", () => {
    const [draft] = blockDraftsFrom([
      {
        id: "00000000-0000-4000-8000-0000000000b1",
        name: "A",
        build_status: "building",
        progress_pct: 58,
        floors_total: 12,
        floors_built: 7,
        deadline_year: 2027,
        deadline_quarter: 4,
        finishing_id: null,
        cadastre: null,
        cadastre_expected_on: null,
        currency: "UZS",
        price_includes: [{ item: { ru: "Кладовая", uz: "Ombor" }, included: false, price: 1500 }],
        units: 88,
        priced_layouts: 2,
      },
    ]);
    expect(draft).toMatchObject({
      deadline: "2027-12-31",
      currency: "UZS",
      units: 88,
      pricedLayouts: 2,
    });
    expect(draft!.priceIncludes[0]).toMatchObject({ included: false, price: "1500" });
  });
});

describe("«Планировки» (И5)", () => {
  it("пределы — как check в миграции", () => {
    const sql = migration("20261019170100_blocks_layouts_units.sql");
    expect(sql).toContain(`rooms between 0 and ${LAYOUT_LIMITS.roomsMax}`);
    expect(sql).toContain("area > 0 and area < 1000");
  });

  it("площадь с запятой, цена с пробелами, чертёж — uuid или ничего", () => {
    const drawing = "00000000-0000-4000-8000-0000000000aa";
    const parsed = parseLayouts(
      formWith("layouts", [layout({ priceFrom: "31 000", drawingId: drawing })]),
    );
    expect(parsed).toEqual({
      ok: true,
      payload: [{ rooms: 1, area: 42.5, drawing_id: drawing, price_from: 31000, available: true }],
    });
    expect(parseLayouts(formWith("layouts", [layout({ drawingId: "../evil" })]))).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("без комнат и площади — ошибки строки; порядок — по комнатам и площади", () => {
    const empty = layout({ key: "e1", rooms: null, area: "" });
    expect(parseLayouts(formWith("layouts", [empty]))).toMatchObject({
      ok: false,
      rowErrors: { e1: { rooms: "roomsRequired", area: "areaRequired" } },
    });
    const sorted = sortLayouts([
      layout({ rooms: 2, area: "58,7" }),
      layout({ rooms: 1, area: "46,8" }),
      layout({ rooms: 1, area: "42,5" }),
    ]);
    expect(sorted.map((row) => `${row.rooms}/${row.area}`)).toEqual(["1/42,5", "1/46,8", "2/58,7"]);
  });

  it("копия: комнаты, площадь и чертёж — те же, цена — заново", () => {
    const copy = newLayoutDraft(
      layout({ id: "x", drawingId: "d", drawingSrc: "src", priceFrom: "31000" }),
    );
    expect(copy).toMatchObject({ id: null, rooms: 1, area: "42,5", drawingId: "d", priceFrom: "" });
  });
});
