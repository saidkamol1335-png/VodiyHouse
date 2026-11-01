import { describe, expect, it } from "vitest";
import { complexCompleteness, layoutCompleteness } from "./completeness";

describe("полнота ЖК и планировок (правило публикации v2)", () => {
  it("планировка: только известные метки «Не хватает»", () => {
    expect(
      layoutCompleteness({ id: "l", block_id: "b", complete: false, missing: ["price", "drawing", "other"] }),
    ).toEqual({ id: "l", blockId: "b", complete: false, missing: ["price", "drawing"] });
  });

  it("ЖК: состояние, чего не хватает, «Полных квартир: k из n»", () => {
    const result = complexCompleteness({
      state: "soon",
      requirements: [
        { requirement: "address", ok: true, have: null },
        { requirement: "payment", ok: false, have: null },
      ],
      cover_ok: true,
      program_ok: true,
      rate_ok: false,
      layouts: [
        { id: "a", block_id: "b", complete: true, missing: [] },
        { id: "c", block_id: "b", complete: false, missing: ["drawing"] },
      ],
    });
    expect(result.state).toBe("soon");
    expect(result.missing).toEqual(["payment"]);
    expect(result.rateOk).toBe(false);
    expect(result.completeLayouts).toBe(1);
    expect(result.layouts).toHaveLength(2);
  });
});
