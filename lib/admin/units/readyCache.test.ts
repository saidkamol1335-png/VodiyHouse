import { describe, expect, it } from "vitest";
import type { UnitRecord } from "@/lib/units";
import { ReadyCache } from "./readyCache";

const unit = (number: string, position: number, fields: Partial<UnitRecord> = {}): UnitRecord => ({
  id: `u${number}`,
  entrance: 1,
  floor: 2,
  position,
  number,
  layoutId: null,
  price: null,
  pricePerM2: null,
  finishingId: null,
  status: "free",
  updatedAt: "2026-10-21T09:41:00Z",
  updatedByName: null,
  ...fields,
});

describe("стояки готового блока — кэш", () => {
  const units = [unit("1", 1), unit("2", 2)];

  it("цена, статус и отделка не пересобирают стояки — снимок тот же", () => {
    const cache = new ReadyCache();
    const first = cache.get(units, 9);
    const touched = [{ ...units[0]!, status: "sold" as const, price: 5 }, units[1]!];
    expect(cache.get(touched, 9)).toBe(first);
  });

  it("место, планировка и этажность — пересобирают", () => {
    const cache = new ReadyCache();
    const first = cache.get(units, 9);
    const layout = cache.get([{ ...units[0]!, layoutId: "L" }, units[1]!], 9);
    expect(layout).not.toBe(first);
    expect(cache.get([units[0]!], 9)).not.toBe(layout);
    const floors = cache.get(units, 9);
    expect(cache.get(units, 12)).not.toBe(floors);
  });
});
