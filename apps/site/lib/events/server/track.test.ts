import { describe, expect, it, vi } from "vitest";
import { batchFrom, trackEvents } from "./track";

const signed = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/supabase/signedWrite", () => ({
  hasSignedWriteEnv: () => true,
  visitorKey: () => "key",
  callSigned: async () => {
    signed.calls += 1;
    return { ok: true };
  },
}));

describe("сотрудник не в статистике (фаза F, п. 40)", () => {
  it("метка vh-staff от кабинета — пачка не записывается и cookie посетителя не выдаются", async () => {
    const body = { events: [{ type: "page_view", path: "/ru" }], lang: "ru", source: null };
    const userAgent = "Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile Safari/537.36";
    expect(await trackEvents({ userAgent, cookies: new Map([["vh-staff", "1"]]), body })).toBeNull();
    expect(signed.calls).toBe(0);
  });
});

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
