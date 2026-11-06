import { describe, expect, it } from "vitest";
import { HOUSE_AD_DEFAULT, houseAdSettingsFrom } from "./houseAd";

describe("houseAdSettingsFrom", () => {
  it("записи нет или она кривая — реклама включена", () => {
    expect(houseAdSettingsFrom(null)).toEqual(HOUSE_AD_DEFAULT);
    expect(houseAdSettingsFrom("off")).toEqual(HOUSE_AD_DEFAULT);
    expect(houseAdSettingsFrom({ enabled: "false" })).toEqual(HOUSE_AD_DEFAULT);
  });

  it("выключатель из записи", () => {
    expect(houseAdSettingsFrom({ enabled: false })).toEqual({ enabled: false });
    expect(houseAdSettingsFrom({ enabled: true })).toEqual({ enabled: true });
  });
});
