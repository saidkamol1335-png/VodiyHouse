import { describe, expect, it } from "vitest";
import {
  compareUnitNumbers,
  foldUnitNumber,
  isUnitNumber,
  normalizeUnitNumber,
  unitNumberMatches,
} from "./number";

describe("номер квартиры", () => {
  it("как в базе: до 10 цифр и букв, «/» и «-»; пробелы по краям не мешают", () => {
    for (const ok of ["1", "12А", "12a", "3/1", "7-Б", " 41 ", "1234567890"]) {
      expect(isUnitNumber(ok), ok).toBe(true);
    }
    for (const bad of ["", "12 Б", "12Ё", "№12", "12345678901", "кв.5"]) {
      expect(isUnitNumber(bad), bad).toBe(false);
    }
  });

  it("номер — без пробелов и заглавными, графика та, в какой ввели", () => {
    expect(normalizeUnitNumber(" 12a ")).toBe("12A");
    expect(normalizeUnitNumber("12а")).toBe("12А");
    // Узбекская латиница остаётся латиницей — порядок «12A, 12B, 12D» не ломается.
    expect(["12d", "12a", "12b"].map(normalizeUnitNumber).sort(compareUnitNumbers)).toEqual([
      "12A",
      "12B",
      "12D",
    ]);
  });

  it("при сравнении латинские двойники — русские: «12A» и «12А» — одно", () => {
    expect(foldUnitNumber("12a")).toBe("12А");
    expect(foldUnitNumber("3/1-b")).toBe("3/1-В");
    expect(foldUnitNumber("12d")).toBe("12D");
  });

  it("порядок как в SQL: числовой префикс, без него — в конце, затем текст", () => {
    const numbers = ["12А", "2", "Б", "10", "12", "1", "А1", "13"];
    expect([...numbers].sort(compareUnitNumbers)).toEqual([
      "1",
      "2",
      "10",
      "12",
      "12А",
      "13",
      "А1",
      "Б",
    ]);
  });

  it("поиск по номеру — без регистра и с двойниками", () => {
    expect(unitNumberMatches("12А", "12a")).toBe(true);
    expect(unitNumberMatches("112", "12")).toBe(true);
    expect(unitNumberMatches("41", "42")).toBe(false);
    expect(unitNumberMatches("41", "  ")).toBe(true);
  });
});
