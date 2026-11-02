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

  it("метки креатива (фаза 6): пробелы → «_» (как у заявок в базе), не строка — null; старый браузер без них — null", () => {
    const batch = batchFrom({ events: [{ type: "layout_view" }], lang: "uz", source: "instagram", medium: "reels", content: " Shodlik  reels 03 " });
    expect(batch).toMatchObject({ source: "instagram", medium: "reels", content: "Shodlik_reels_03" });
    expect(batch?.events).toEqual([{ type: "layout_view" }]);
    expect(batchFrom({ events: [event], lang: "ru", source: null, medium: 5 })).toMatchObject({ medium: null, content: null });
  });
});
