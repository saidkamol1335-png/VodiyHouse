import { describe, expect, it } from "vitest";
import { EMPTY_CALC_PARAMS } from "@/lib/calc/params";
import { searchContradicts, searchWith } from "./useCalcParams";

// Адрес расчёта: ключи расчёта переписываются, чужие остаются — utm-метки рекламы на /kalkulyator
// и ?plan= открытой планировки на странице ЖК не теряются при первом же движении ползунка.

describe("адрес расчёта", () => {
  it("чужие ключи остаются, ключи расчёта — из состояния", () => {
    const search = searchWith("?utm_source=tg&plan=l1&down=30&months=36", {
      ...EMPTY_CALC_PARAMS,
      downPct: 50,
    });
    expect(new URLSearchParams(search).toString()).toBe("utm_source=tg&plan=l1&down=50");
  });

  it("очищенный ключ расчёта уходит из адреса", () => {
    expect(searchWith("?sum=100000&mode=sum", { ...EMPTY_CALC_PARAMS, mode: "area" })).toBe(
      "mode=area",
    );
  });
});

// После «Назад» → «Вперёд» роутер отдаёт пропсы прежнего адреса при новом адресе — адрес главнее.
describe("адрес спорит с начальными параметрами", () => {
  const initial = { ...EMPTY_CALC_PARAMS, developer: "demo-sifat", months: 24 };

  it("другой срок в адресе — спор", () => {
    expect(searchContradicts("months=12&developer=demo-sifat", initial)).toBe(true);
  });

  it("ключа нет или в нём мусор — спора нет", () => {
    expect(searchContradicts("", initial)).toBe(false);
    expect(searchContradicts("months=abc&utm_source=tg", initial)).toBe(false);
  });

  it("тот же срок и чужой застройщик — спора нет: застройщика выбирает сервер", () => {
    expect(searchContradicts("months=24&developer=other", initial)).toBe(false);
  });
});
