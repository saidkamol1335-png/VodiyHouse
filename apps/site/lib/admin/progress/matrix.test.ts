import { describe, expect, it } from "vitest";
import { buildMatrix, type MatrixReport } from "./matrix";

const NOW = new Date("2026-10-29T08:00:00Z");
const MONTHS = ["2026-08-01", "2026-09-01", "2026-10-01"];
const report = (
  patch: Partial<MatrixReport> & Pick<MatrixReport, "complexId" | "month">,
): MatrixReport => ({
  id: crypto.randomUUID(),
  status: "published",
  publishedAt: `${patch.month.slice(0, 8)}16T07:00:00Z`,
  ...patch,
});

describe("матрица «Отчёты по ЖК» (фаза 5)", () => {
  it("ячейки: опубликован с датой, на проверке, ждём (этот месяц), нет (прошлый), сдан", () => {
    const matrix = buildMatrix(
      [
        { id: "a", name: "Yulduz", built: false },
        { id: "b", name: "Bahor", built: true },
      ],
      [
        report({ complexId: "a", month: "2026-08-01" }),
        report({ complexId: "a", month: "2026-10-01", status: "review", publishedAt: null }),
      ],
      MONTHS,
      NOW,
    );
    expect(matrix.rows.map((row) => row.name)).toEqual(["Bahor", "Yulduz"]);
    const yulduz = matrix.rows[1]!;
    expect(yulduz.cells.map((cell) => cell.kind)).toEqual(["published", "none", "review"]);
    expect(yulduz.cells[0]).toMatchObject({ date: "16.08" });
    expect(matrix.rows[0]!.cells.map((cell) => cell.kind)).toEqual(["built", "built", "built"]);
  });

  it("«45+ дн.»: последний опубликованный старше 45 дней или отчётов нет; сданный ЖК — нет", () => {
    const matrix = buildMatrix(
      [
        { id: "fresh", name: "A", built: false },
        { id: "old", name: "B", built: false },
        { id: "never", name: "C", built: false },
        { id: "built", name: "D", built: true },
      ],
      [
        report({ complexId: "fresh", month: "2026-10-01", publishedAt: "2026-10-02T07:00:00Z" }),
        report({ complexId: "old", month: "2026-08-01", publishedAt: "2026-08-20T07:00:00Z" }),
      ],
      MONTHS,
      NOW,
    );
    expect(matrix.rows.map((row) => [row.name, row.late])).toEqual([
      ["A", false],
      ["B", true],
      ["C", true],
      ["D", false],
    ]);
    expect(matrix.late).toBe(2);
    expect(matrix.rows[2]!.cells.map((cell) => cell.kind)).toEqual(["none", "none", "wait"]);
  });
});
