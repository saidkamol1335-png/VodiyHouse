import { describe, expect, it } from "vitest";
import { replyCount, unitReply } from "./reply";

describe("ответы функций базы для «Квартир»", () => {
  it("число из ответа; нет ключа или не число — 0", () => {
    expect(replyCount({ complex_id: "c", changed: 3 }, "changed")).toBe(3);
    expect(replyCount({ changed: "3" }, "changed")).toBe(0);
    expect(replyCount(null, "deleted")).toBe(0);
  });

  it("квартира строки — с именем того, кто правил; сбой разбора — «не получилось», не исключение", () => {
    const unit = {
      id: "6f9619ff-8b86-4011-b42d-00cf4fc964ff",
      entrance: 1,
      floor: 2,
      position: 1,
      number: "41",
      layout_id: null,
      price: null,
      price_per_m2: "620.00",
      finishing_id: null,
      status: "free",
      updated_at: "2026-10-21T09:41:00+05:00",
      updated_by_name: "Дилноза",
      block_id: "ignored",
    };
    expect(unitReply({ unit })).toMatchObject({
      status: "done",
      unit: { number: "41", pricePerM2: 620, updatedByName: "Дилноза" },
    });
    expect(unitReply({ unit: { ...unit, status: "lost" } })).toMatchObject({
      status: "error",
      error: "unknown",
    });
    expect(unitReply(null)).toMatchObject({ status: "error", error: "unknown" });
  });
});
