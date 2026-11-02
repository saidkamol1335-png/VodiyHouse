import { describe, expect, it } from "vitest";
import { NO_FILTER } from "./filter";
import { filterFromSearch, searchFromFilter } from "./params";

describe("фильтр каталога в адресе", () => {
  it("имена мокапа туда и обратно", () => {
    const search = "?komnat=1,2&gorod=fergana&ot=30000&do=60000&srok=2027&oplata=inst,bank&zastr=demo-sifat&otdelka=white-box&sort=cheap";
    const filter = filterFromSearch(Object.fromEntries(new URLSearchParams(search)));
    expect(filter).toEqual({
      rooms: [1, 2],
      priceMin: 30000,
      priceMax: 60000,
      locations: ["fergana"],
      developers: ["demo-sifat"],
      deadline: 2027,
      payments: ["inst", "bank"],
      finishings: ["white-box"],
      sort: "cheap",
    });
    expect(searchFromFilter(filter)).toBe(search);
  });

  it("чужие значения пропускаются: битая ссылка — каталог без фильтра", () => {
    const filter = filterFromSearch({ komnat: "7,x,1,1", ot: "-5", do: "1e9", srok: "скоро", oplata: "barter", sort: "random", gorod: "<b>" });
    expect(filter).toEqual({ ...NO_FILTER, rooms: [1] });
    expect(searchFromFilter(NO_FILTER)).toBe("");
  });

  it("«Сдан» и несколько значений одного параметра — первое", () => {
    expect(filterFromSearch({ srok: ["built", "2026"] }).deadline).toBe("built");
  });
});
