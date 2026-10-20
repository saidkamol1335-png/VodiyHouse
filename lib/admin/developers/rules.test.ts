import { describe, expect, it } from "vitest";
import { PUBLICATION_STATUSES } from "../publication";
import { contentDbErrorCode } from "./errors";
import {
  filterCounts,
  filterDevelopers,
  parseDeveloperRows,
  type DeveloperRowRecord,
} from "./list";
import {
  archiveConfirmed,
  canMove,
  deletionDate,
  missingForPublish,
  STATUS_MOVES,
} from "./publication";

const record = (overrides: Partial<DeveloperRowRecord>): DeveloperRowRecord => ({
  id: crypto.randomUUID(),
  slug: "demo-sifat",
  name: "Farg‘ona Sifat Qurilish",
  status: "published",
  founded_year: 2012,
  flats_delivered: 2140,
  delivered_checked_at: "2026-09-14",
  archived_at: null,
  complexes: 2,
  logo_path: null,
  ...overrides,
});

describe("статус застройщика", () => {
  it("в архив — из любого статуса, из архива — только в черновик; на месте не стоим", () => {
    for (const status of PUBLICATION_STATUSES) {
      expect(canMove(status, status)).toBe(false);
      if (status !== "archived") expect(canMove(status, "archived")).toBe(true);
    }
    expect(STATUS_MOVES.archived).toEqual(["draft"]);
    expect(canMove("published", "draft")).toBe(false);
  });

  it("для публикации нужны «О компании» и логотип", () => {
    expect(missingForPublish({ hasAbout: false, hasLogo: false })).toEqual(["about", "logo"]);
    expect(missingForPublish({ hasAbout: true, hasLogo: true })).toEqual([]);
  });

  it("архив удаляется через 30 дней; подтверждение — название с любым апострофом и регистром", () => {
    expect(deletionDate("2026-10-20T10:00:00Z").toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(archiveConfirmed("farg'ona sifat  qurilish", "Farg‘ona Sifat Qurilish")).toBe(true);
    expect(archiveConfirmed("Farg‘ona Sifat", "Farg‘ona Sifat Qurilish")).toBe(false);
    expect(archiveConfirmed("  ", "  ")).toBe(false);
  });
});

describe("список застройщиков", () => {
  const rows = parseDeveloperRows([
    record({ name: "Farg‘ona Sifat Qurilish", slug: "fargona-sifat" }),
    record({ name: "Marg‘ilon Invest", slug: "margilon-invest", status: "draft" }),
    record({
      name: "Kamalak Development",
      slug: "kamalak",
      status: "archived",
      archived_at: "2026-10-01T00:00:00Z",
    }),
    record({ name: "Yangi", slug: "yangi", status: "unknown" }),
  ]);

  it("неизвестный статус из базы — черновик; нет ЖК — 0", () => {
    expect(rows[3]?.status).toBe("draft");
    expect(parseDeveloperRows([record({ complexes: null })])[0]?.complexes).toBe(0);
  });

  it("«Все» — без архива; пилюли считают по статусам", () => {
    expect(filterCounts(rows)).toEqual({ all: 3, draft: 2, published: 1, hidden: 0, archived: 1 });
    expect(
      filterDevelopers(rows, { query: "", filter: "all" }).map((row) => row.slug),
    ).not.toContain("kamalak");
  });

  it("поиск без апострофов и регистра, по названию и адресу", () => {
    expect(
      filterDevelopers(rows, { query: "fargona", filter: "all" }).map((row) => row.slug),
    ).toEqual(["fargona-sifat"]);
    expect(
      filterDevelopers(rows, { query: "MARG'ILON", filter: "all" }).map((row) => row.slug),
    ).toEqual(["margilon-invest"]);
    expect(filterDevelopers(rows, { query: "kamalak", filter: "archived" })).toHaveLength(1);
  });
});

describe("ошибки базы → коды", () => {
  it("hint важнее кода; сбой сети — network", () => {
    expect(contentDbErrorCode({ code: "23514", hint: "vh:not_ready" })).toBe("notReady");
    expect(contentDbErrorCode({ code: "42501", hint: "vh:forbidden" })).toBe("forbidden");
    expect(contentDbErrorCode({ code: "P0002" })).toBe("notFound");
    expect(contentDbErrorCode({ code: "23505" })).toBe("duplicate");
    expect(contentDbErrorCode({ code: "", message: "TypeError: fetch failed" })).toBe("network");
    expect(contentDbErrorCode({ code: "XX000" })).toBe("unknown");
  });
});

describe("DEMO стендов", () => {
  it("id — настоящие uuid: сервер принимает сохранение вкладки как есть", async () => {
    const { DEMO_DEVELOPER_ROWS, DEMO_PROJECTS } = await import("./demo");
    const { parseProjects } = await import("./projects");
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    for (const row of DEMO_DEVELOPER_ROWS) expect(row.id).toMatch(UUID);
    const form = new FormData();
    form.append("projects", JSON.stringify(DEMO_PROJECTS));
    expect(parseProjects(form).ok).toBe(true);
  });
});
