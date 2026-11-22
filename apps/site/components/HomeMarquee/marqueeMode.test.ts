import { describe, expect, it } from "vitest";
import type { DeveloperSummary } from "@/lib/site/developers/records";
import { marqueeLogos, marqueeMode } from "./marqueeMode";

describe("строка логотипов застройщиков (правки 15.11, п. 27)", () => {
  it("нет логотипов — строки нет; 1–4 — статичный ряд; от 5 — бежит", () => {
    expect(marqueeMode(0)).toBe("none");
    expect(marqueeMode(1)).toBe("static");
    expect(marqueeMode(4)).toBe("static");
    expect(marqueeMode(5)).toBe("running");
  });

  it("застройщики без логотипа не попадают; без облака — пусто", () => {
    const logo = { path: "developers/a/logo.png", width: 400, height: 400, blur: null } as unknown as DeveloperSummary["logo"];
    const rows = [{ slug: "a", logo }, { slug: "b", logo: null }] as unknown as DeveloperSummary[];
    expect(marqueeLogos(rows).map((row) => row.slug)).toEqual(["a"]);
    expect(marqueeLogos(null)).toEqual([]);
  });
});
