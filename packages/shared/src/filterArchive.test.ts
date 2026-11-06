import { describe, expect, it } from "vitest";
import {
  archiveFilterItem,
  archiveIdSection,
  archiveIdValue,
  EMPTY_FILTER_ARCHIVE,
  FILTER_ARCHIVE_MAX,
  filterArchiveFrom,
  filterVisibility,
  isFilterArchiveId,
  restoreFilterItem,
} from "./filterArchive";

const AT = "2026-11-06T10:00:00.000Z";

describe("isFilterArchiveId", () => {
  it("понимает блоки и кнопки фильтра", () => {
    for (const id of [
      "section:price",
      "section:payment",
      "rooms:0",
      "rooms:4",
      "payment:mort",
      "deadline:built",
      "deadline:2028",
      "developer:fsq",
      "location:fargona-shahri",
      "finishing:white-box",
    ]) {
      expect(isFilterArchiveId(id), id).toBe(true);
    }
  });

  it("отбрасывает чужое и кривое", () => {
    for (const id of [
      "section:sort",
      "price:100",
      "sort:cheap",
      "rooms:",
      "payment:Mort",
      "developer:../x",
      "",
      42,
      null,
      "section:",
    ]) {
      expect(isFilterArchiveId(id), String(id)).toBe(false);
    }
  });
});

describe("filterArchiveFrom", () => {
  it("пустое и чужое значение — пустой архив", () => {
    expect(filterArchiveFrom(null)).toEqual(EMPTY_FILTER_ARCHIVE);
    expect(filterArchiveFrom("x")).toEqual(EMPTY_FILTER_ARCHIVE);
    expect(filterArchiveFrom({ items: "x" })).toEqual(EMPTY_FILTER_ARCHIVE);
  });

  it("убирает повторы и кривые записи, чинит дату", () => {
    const archive = filterArchiveFrom({
      items: [
        { id: "payment:mort", at: AT },
        { id: "payment:mort", at: AT },
        { id: "bad id", at: AT },
        null,
        { id: "rooms:0", at: "вчера" },
      ],
    });
    expect(archive.items).toEqual([
      { id: "payment:mort", at: AT },
      { id: "rooms:0", at: new Date(0).toISOString() },
    ]);
  });

  it("не больше FILTER_ARCHIVE_MAX записей", () => {
    const items = Array.from({ length: FILTER_ARCHIVE_MAX + 5 }, (_, i) => ({
      id: `developer:d${i}`,
      at: AT,
    }));
    expect(filterArchiveFrom({ items }).items).toHaveLength(FILTER_ARCHIVE_MAX);
  });
});

describe("archiveFilterItem / restoreFilterItem", () => {
  it("кладёт в архив один раз и возвращает", () => {
    const one = archiveFilterItem(EMPTY_FILTER_ARCHIVE, "payment:bank", AT);
    expect(one.items).toEqual([{ id: "payment:bank", at: AT }]);
    expect(archiveFilterItem(one, "payment:bank", "2027-01-01T00:00:00.000Z")).toBe(one);
    expect(restoreFilterItem(one, "payment:bank")).toEqual(EMPTY_FILTER_ARCHIVE);
  });

  it("кривой id не попадает в архив", () => {
    expect(archiveFilterItem(EMPTY_FILTER_ARCHIVE, "sort:cheap", AT)).toBe(EMPTY_FILTER_ARCHIVE);
  });
});

describe("archiveIdSection / archiveIdValue", () => {
  it("разбирает id", () => {
    expect(archiveIdSection("section:price")).toBe("price");
    expect(archiveIdSection("deadline:2028")).toBe("deadline");
    expect(archiveIdSection("sort:cheap")).toBeNull();
    expect(archiveIdValue("deadline:2028")).toBe("2028");
    expect(archiveIdValue("section:price")).toBeNull();
  });
});

describe("filterVisibility", () => {
  it("скрытый блок прячет все свои кнопки", () => {
    const visible = filterVisibility(["section:payment", "rooms:0"]);
    expect(visible.section("payment")).toBe(false);
    expect(visible.option("payment", "full")).toBe(false);
    expect(visible.section("rooms")).toBe(true);
    expect(visible.option("rooms", 0)).toBe(false);
    expect(visible.option("rooms", 1)).toBe(true);
    expect(visible.section("price")).toBe(true);
  });
});
