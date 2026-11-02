import { describe, expect, it } from "vitest";
import { filterQuery, filterSearchFrom, filterValues, isEmptyFilter, readFilterSearch } from "./filterForm";

const form = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

describe("фильтр подборки и рекламы — параметры адреса каталога", () => {
  it("из формы: чипы через запятую, чужое отпадает, пустое не пишется", () => {
    const search = readFilterSearch(
      form([
        ["filter.komnat", "1"],
        ["filter.komnat", "2"],
        ["filter.komnat", "9"],
        ["filter.do", "45000"],
        ["filter.ot", ""],
        ["filter.srok", "built"],
        ["filter.oplata", "bank"],
        ["filter.gorod", "fergana"],
        ["filter.zastr", "Не slug!"],
      ]),
    );
    expect(search).toEqual({ komnat: "1,2", gorod: "fergana", do: "45000", srok: "built", oplata: "bank" });
    expect(filterQuery(search)).toBe("?komnat=1,2&gorod=fergana&do=45000&srok=built&oplata=bank");
  });

  it("из базы: только строки, в едином виде; не объект — пусто", () => {
    expect(filterSearchFrom({ komnat: "2,1,2", srok: "2027", extra: 1 })).toEqual({ komnat: "1,2", srok: "2027" });
    expect(filterSearchFrom(null)).toEqual({});
    expect(filterSearchFrom(["komnat"])).toEqual({});
    expect(isEmptyFilter(filterSearchFrom({ sort: "rec" }))).toBe(true);
  });

  it("значения параметра для формы", () => {
    expect(filterValues({ komnat: "0,1" }, "komnat")).toEqual(["0", "1"]);
    expect(filterValues({}, "oplata")).toEqual([]);
  });
});
