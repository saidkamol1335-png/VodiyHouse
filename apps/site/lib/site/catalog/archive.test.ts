import { filterVisibility } from "@vh/shared/filterArchive";
import { describe, expect, it } from "vitest";
import { withActive } from "./archive";
import { NO_FILTER } from "./filter";

describe("withActive", () => {
  it("без выбора — как архив", () => {
    const visible = withActive(filterVisibility(["payment:mort", "section:price"]), NO_FILTER);
    expect(visible.option("payment", "mort")).toBe(false);
    expect(visible.option("payment", "full")).toBe(true);
    expect(visible.section("price")).toBe(false);
  });

  it("выбранная кнопка из архива видна (ссылка рекламы, квиза, подборки)", () => {
    const filter = {
      ...NO_FILTER,
      payments: ["mort" as const],
      developers: ["fsq"],
      rooms: [0],
      deadline: 2028,
    };
    const visible = withActive(
      filterVisibility(["payment:mort", "developer:fsq", "rooms:0", "deadline:2028", "rooms:1"]),
      filter,
    );
    expect(visible.option("payment", "mort")).toBe(true);
    expect(visible.option("developer", "fsq")).toBe(true);
    expect(visible.option("rooms", 0)).toBe(true);
    expect(visible.option("rooms", 1)).toBe(false);
    expect(visible.option("deadline", 2028)).toBe(true);
  });

  it("скрытый блок виден, пока в нём что-то выбрано, — только с выбранными кнопками", () => {
    const filter = { ...NO_FILTER, payments: ["bank" as const], priceMax: 50000 };
    const visible = withActive(
      filterVisibility(["section:payment", "section:price", "section:finishing"]),
      filter,
    );
    expect(visible.section("payment")).toBe(true);
    expect(visible.option("payment", "bank")).toBe(true);
    expect(visible.option("payment", "full")).toBe(false);
    expect(visible.section("price")).toBe(true);
    expect(visible.section("finishing")).toBe(false);
  });
});
