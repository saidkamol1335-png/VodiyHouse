import { EMPTY_FILTER_ARCHIVE, type FilterArchive } from "@vh/shared/filterArchive";
import { describe, expect, it } from "vitest";
import type { SiteCatalog } from "@/lib/site/catalog/records";
import { type FilterArchiveLabels, filterArchiveGroups } from "./groups";

const LABELS: FilterArchiveLabels = {
  room: (rooms) => (rooms === 0 ? "Студия" : rooms === 4 ? "4+" : String(rooms)),
  payment: (kind) => kind.toUpperCase(),
  built: "Сдан",
  upTo: (year) => `до ${year}`,
};

const block = (year: number, finishing: string | null, buildStatus = "building") => ({
  buildStatus,
  deadline: { year, quarter: 4 },
  finishing: finishing
    ? { slug: finishing, name: { ru: finishing.toUpperCase(), uz: finishing } }
    : null,
});

const CATALOG = {
  rate: null,
  developers: [{ id: "d1", slug: "fsq", name: "FSQ", programs: [] }],
  complexes: [
    {
      location: { slug: "fargona", name: { ru: "Фергана", uz: "Farg‘ona" } },
      blocks: [block(2028, "white-box"), block(2027, null), block(2026, "white-box", "built")],
    },
    {
      location: { slug: "fargona", name: { ru: "Фергана", uz: "Farg‘ona" } },
      blocks: [block(2029, "chernovaya"), block(2030, null)],
    },
  ],
} as unknown as SiteCatalog;

const ids = (archive: FilterArchive, section: string) =>
  filterArchiveGroups(archive, CATALOG, LABELS)
    .find((group) => group.section === section)
    ?.options.map((option) => option.id);

describe("filterArchiveGroups", () => {
  it("блоки в порядке сайта, кнопки — как на сайте", () => {
    const groups = filterArchiveGroups(EMPTY_FILTER_ARCHIVE, CATALOG, LABELS);
    expect(groups.map((group) => group.section)).toEqual([
      "rooms",
      "price",
      "location",
      "payment",
      "deadline",
      "developer",
      "finishing",
    ]);
    expect(ids(EMPTY_FILTER_ARCHIVE, "rooms")).toEqual([
      "rooms:0",
      "rooms:1",
      "rooms:2",
      "rooms:3",
      "rooms:4",
    ]);
    // Три ближайших года строящихся блоков; сданный 2026 — не год, а «Сдан».
    expect(ids(EMPTY_FILTER_ARCHIVE, "deadline")).toEqual([
      "deadline:built",
      "deadline:2027",
      "deadline:2028",
      "deadline:2029",
    ]);
    expect(ids(EMPTY_FILTER_ARCHIVE, "location")).toEqual(["location:fargona"]);
    expect(ids(EMPTY_FILTER_ARCHIVE, "finishing")).toEqual([
      "finishing:white-box",
      "finishing:chernovaya",
    ]);
    expect(ids(EMPTY_FILTER_ARCHIVE, "price")).toEqual([]);
  });

  it("помечает архив и оставляет кнопки, которых на сайте уже нет", () => {
    const archive: FilterArchive = {
      items: [
        { id: "section:price", at: "2026-11-06T10:00:00.000Z" },
        { id: "payment:mort", at: "2026-11-06T11:00:00.000Z" },
        { id: "developer:old-dev", at: "2026-11-01T09:00:00.000Z" },
        { id: "deadline:2025", at: "2026-11-01T09:00:00.000Z" },
      ],
    };
    const groups = filterArchiveGroups(archive, CATALOG, LABELS);
    expect(groups.find((group) => group.section === "price")?.archivedAt).toBe(
      "2026-11-06T10:00:00.000Z",
    );
    const payment = groups.find((group) => group.section === "payment");
    expect(payment?.options.find((option) => option.id === "payment:mort")?.archivedAt).toBe(
      "2026-11-06T11:00:00.000Z",
    );
    expect(payment?.options.find((option) => option.id === "payment:full")?.archivedAt).toBeNull();
    const developer = groups.find((group) => group.section === "developer");
    expect(developer?.options.map((option) => option.label)).toEqual(["FSQ", "old-dev"]);
    const deadline = groups.find((group) => group.section === "deadline");
    expect(deadline?.options.at(-1)).toEqual({
      id: "deadline:2025",
      label: "до 2025",
      archivedAt: "2026-11-01T09:00:00.000Z",
    });
  });

  it("без каталога — комнаты, оплата и «Сдан»", () => {
    const groups = filterArchiveGroups(EMPTY_FILTER_ARCHIVE, null, LABELS);
    expect(groups.find((group) => group.section === "payment")?.options).toHaveLength(4);
    expect(
      groups.find((group) => group.section === "deadline")?.options.map((option) => option.id),
    ).toEqual(["deadline:built"]);
    expect(groups.find((group) => group.section === "developer")?.options).toEqual([]);
  });
});
