import { describe, expect, it } from "vitest";
import { flatCalcFrom } from "@/lib/calc/flatScreen";
import { roundMoney } from "@/lib/calc/money";
import { SITE_ENGINE } from "@/lib/calc/options";
import { EMPTY_CALC_PARAMS, type CalcParams } from "@/lib/calc/params";
import { calculatorView } from "@/lib/calc/view";
import { demoFlatCalc, demoFlatLayouts } from "./flatDemo";

// DEMO «Расчёта для этой квартиры» (шаг 2.7) даёт числа мокапа через тот же преобразователь,
// что и ответ site_layout_calc(): SiteJkCalc1 (кв. 8, Ipoteka Bank 20 % · 24 мес.) и MobFlatTerm
// (кв. 43, схема 50 % · свои 17 мес.); на сайте — без скидок (PLAN §3.13).

const layoutOf = (area: number) => demoFlatLayouts().find((layout) => layout.area === area)!;

function viewOf(
  area: number,
  patch: (screen: ReturnType<typeof flatCalcFrom>) => Partial<CalcParams>,
) {
  const screen = flatCalcFrom(demoFlatCalc(layoutOf(area).id)!);
  const params = { ...EMPTY_CALC_PARAMS, ...patch(screen) };
  return { screen, view: calculatorView(SITE_ENGINE, screen.data, params, screen.modes) };
}

const optionId = (screen: ReturnType<typeof flatCalcFrom>, type: string) =>
  screen.data.options.find((option) => option.program.type === type)!.id;

describe("DEMO расчёта квартиры", () => {
  it("SiteJkCalc1: 3-комн. 78 м², «свободно: 2», по умолчанию кв. 8 · $54 930", () => {
    const { screen, view } = viewOf(78, () => ({}));
    expect(screen.modes).toEqual(["unit"]);
    expect(screen.data.stock.units.map((unit) => [unit.number, unit.floor])).toEqual([
      ["8", 3],
      ["88", 12],
    ]);
    expect(view.price).toMatchObject({ mode: "unit", price: 54_930, areaM2: 78 });
  });

  it("SiteJkCalc1: Ipoteka Bank 20 % · 24 мес. → 25 907 000 сум, итог 758 184 000 сум", () => {
    const { view } = viewOf(78, (screen) => ({
      program: optionId(screen, "bank_installment"),
      downPct: 20,
      months: 24,
    }));
    const calc = view.result?.ok ? view.result.calculation : null;
    expect(calc && roundMoney(calc.firstPayment, "UZS")).toBe(25_907_000);
    expect(calc && roundMoney(calc.total, "UZS")).toBe(758_184_000);
  });

  it("MobFlatTerm: кв. 43 · $47 640, схема 50 % и свои 17 мес. → $1 401 (без скидки)", () => {
    const { view } = viewOf(64.2, (screen) => ({
      unit: screen.data.stock.units.find((unit) => unit.number === "43")!.id,
      program: optionId(screen, "installment"),
      downPct: 50,
      months: 17,
    }));
    const calc = view.result?.ok ? view.result.calculation : null;
    expect(view.price.price).toBe(47_640);
    expect(calc && roundMoney(calc.firstPayment, "USD")).toBe(1_401);
    expect(calc?.total).toBe(47_640);
  });

  it("программы — только блока планировки: ипотека «блок A» у блока B не видна", () => {
    const blockB = demoFlatLayouts().find((layout) => layout.blockName === "B")!;
    const types = flatCalcFrom(demoFlatCalc(blockB.id)!).data.options.map((o) => o.program.type);
    expect(types).not.toContain("mortgage");
    expect(flatCalcFrom(demoFlatCalc(layoutOf(78).id)!).data.options).toHaveLength(4);
  });

  it("ответ без полей скидки; чужая планировка — null", () => {
    expect(JSON.stringify(demoFlatCalc(layoutOf(78).id))).not.toMatch(/discount/i);
    expect(demoFlatCalc("00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("планировка «по запросу» (свободная кв. 5 без цены) — расчёта нет, карточки на стенде нет", () => {
    expect(demoFlatLayouts().map((layout) => layout.area)).not.toContain(42.5);
  });

  it("без квартир с ценой — «цена от» планировки, а не пустой расчёт без поля", () => {
    const record = { ...demoFlatCalc(layoutOf(78).id)!, units: [] };
    const screen = flatCalcFrom(record);
    expect(screen.modes).toEqual(["layout"]);
    const view = calculatorView(SITE_ENGINE, screen.data, EMPTY_CALC_PARAMS, screen.modes);
    expect(view.price).toMatchObject({ mode: "layout", price: 54_930 });
    expect(view.result?.ok).toBe(true);
  });

  it("курса нет — программ банков в сумах нет, вместо них строка «курс недоступен»", () => {
    const screen = flatCalcFrom({ ...demoFlatCalc(layoutOf(78).id)!, rate: null });
    const currencies = screen.data.options.map((option) =>
      "currency" in option.program ? option.program.currency : null,
    );
    expect(currencies).not.toContain("UZS");
    expect(screen.data.options.length).toBeGreaterThan(0);
    expect(screen.data.hiddenForRate).toBe(true);
    expect(flatCalcFrom(demoFlatCalc(layoutOf(78).id)!).data.hiddenForRate).toBe(false);
  });

  it("?mode=sum из адреса не подменяет цену квартиры", () => {
    const { view } = viewOf(78, () => ({ mode: "sum", sum: "1000" }));
    expect(view.price).toMatchObject({ mode: "unit", price: 54_930 });
  });
});
