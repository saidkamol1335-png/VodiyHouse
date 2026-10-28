import { describe, expect, it } from "vitest";
import { batchFrom } from "./track";

const TAB = "0b6f4f0e-7a0e-4c3a-9a51-3d3c2b1a0f11";
const event = { type: "page_view", path: "/ru" };

describe("пачка событий", () => {
  it("id вкладки — только uuid: он заменяет посетителя, если cookie запрещены", () => {
    expect(batchFrom({ events: [event], lang: "ru", source: null, tab: TAB })?.tab).toBe(TAB);
    expect(batchFrom({ events: [event], lang: "ru", source: null, tab: "не-uuid" })).not.toHaveProperty("tab");
    expect(batchFrom({ events: [event], lang: "ru", source: null })).not.toHaveProperty("tab");
  });
});
