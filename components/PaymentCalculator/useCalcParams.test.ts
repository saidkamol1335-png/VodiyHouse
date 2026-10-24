import { describe, expect, it } from "vitest";
import { EMPTY_CALC_PARAMS } from "@/lib/calc/params";
import { searchWith } from "./useCalcParams";

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
