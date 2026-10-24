import { describe, expect, it } from "vitest";
import type { CabinetProgram } from "./cabinet/discounts";
import { CABINET_ENGINE, downOptionDiscountPct } from "./cabinet/engine";
import {
  MOCKUP_RATE,
  SIFAT_FULL,
  SIFAT_IPOTEKA_INSTALLMENT,
  SIFAT_IPOTEKA_MORTGAGE,
  SIFAT_SCHEME,
} from "./fixtures";
import { roundMoney } from "./money";
import { type ProgramOption, SITE_ENGINE } from "./options";
import { EMPTY_CALC_PARAMS, type CalcParams, readCalcParams, writeCalcParams } from "./params";
import type { CalcStock } from "./priceSource";
import { type CalcData, calculatorView, shareParams } from "./view";

// Калькулятор из данных и адреса (шаг 2.5): один и тот же адрес в кабинете и на сайте даёт
// одинаковый выбор, а цифры — каждый своим движком (PLAN §7: 17 мес. → $2 765 и $2 941).

const option = (id: string, program: CabinetProgram, patch: Partial<ProgramOption> = {}) =>
  ({
    id,
    kind: program.type === "full" ? "full" : program.type === "installment" ? "scheme" : "bank",
    bankName: null,
    blocksScope: "all",
    blockIds: [],
    updatedAt: null,
    program,
    ...patch,
  }) as ProgramOption<CabinetProgram>;

const STOCK: CalcStock = {
  blocks: [
    {
      id: "b1",
      name: "A",
      complexId: "c1",
      complexName: { ru: "Shodlik", uz: "Shodlik" },
      currency: "USD",
    },
    {
      id: "b2",
      name: "B",
      complexId: "c1",
      complexName: { ru: "Shodlik", uz: "Shodlik" },
      currency: "USD",
    },
  ],
  layouts: [
    { id: "l0", blockId: "b1", rooms: 1, area: 40, priceFrom: null, available: true },
    { id: "l1", blockId: "b2", rooms: 2, area: 64.2, priceFrom: 45_480, available: true },
  ],
  units: [
    {
      id: "u0",
      number: "1",
      floor: 2,
      blockId: "b1",
      layoutId: "l0",
      rooms: 1,
      area: 40,
      price: null,
    },
    {
      id: "u1",
      number: "88",
      floor: 12,
      blockId: "b1",
      layoutId: null,
      rooms: 3,
      area: 100,
      price: 100_000,
    },
  ],
  priceHint: { perM2: 685.981308411215, currency: "USD" },
};

const DATA: CalcData<CabinetProgram> = {
  options: [
    option("full", SIFAT_FULL),
    option("scheme", SIFAT_SCHEME),
    option("bank", SIFAT_IPOTEKA_INSTALLMENT),
    option("mortgage", SIFAT_IPOTEKA_MORTGAGE, { blocksScope: "selected", blockIds: ["b2"] }),
  ],
  stock: STOCK,
  rate: MOCKUP_RATE,
};

const params = (patch: Partial<CalcParams>): CalcParams => ({ ...EMPTY_CALC_PARAMS, ...patch });
const paymentOf = (view: ReturnType<typeof calculatorView>) => {
  if (!view.result?.ok) throw new Error("нет расчёта");
  const { firstPayment, currency } = view.result.calculation;
  return roundMoney(firstPayment, currency);
};

describe("калькулятор: выбор и цифры", () => {
  it("квартира $100 000, схема, взнос 50 %, свой срок 17: кабинет $2 765, сайт $2 941", () => {
    const chosen = params({ unit: "u1", downPct: 50, months: 17 });
    const cabinet = calculatorView(CABINET_ENGINE, DATA, chosen, true);
    expect(cabinet.selected?.id).toBe("scheme");
    expect(paymentOf(cabinet)).toBe(2765);
    const site = calculatorView(SITE_ENGINE, DATA, chosen, true);
    expect(paymentOf(site)).toBe(2941);
  });

  it("по умолчанию: квартира с ценой, рассрочка застройщика, минимальный взнос", () => {
    const view = calculatorView(CABINET_ENGINE, DATA, EMPTY_CALC_PARAMS, true);
    expect(view.price).toMatchObject({ mode: "unit", unitId: "u1", price: 100_000, blockId: "b1" });
    expect(view.selected?.id).toBe("scheme");
    expect(view.downPct).toBe(30);
    expect(view.termButtons).toEqual([12, 24, 36]);
    expect(view.customMonths).toBe(true);
  });

  it("программы по блоку квартиры; площадь × цена м² — все, 60 м² × $690", () => {
    const unit = calculatorView(CABINET_ENGINE, DATA, EMPTY_CALC_PARAMS, true);
    expect(unit.options.map((item) => item.id)).toEqual(["full", "scheme", "bank"]);
    const area = calculatorView(CABINET_ENGINE, DATA, params({ mode: "area" }), true);
    expect(area.options).toHaveLength(4);
    expect(area.price).toMatchObject({ price: 41_400, areaM2: 60, perM2: 690, currency: "USD" });
  });

  it("без квартир (сайт) — площадь; планировка без цены не выбирается; сумма — как набрана", () => {
    expect(calculatorView(SITE_ENGINE, DATA, EMPTY_CALC_PARAMS, false).price.mode).toBe("area");
    const layout = calculatorView(
      SITE_ENGINE,
      DATA,
      params({ mode: "layout", layout: "l0" }),
      true,
    );
    expect(layout.price).toMatchObject({ layoutId: "l1", price: 45_480, blockId: "b2" });
    const sum = calculatorView(SITE_ENGINE, DATA, params({ mode: "sum", sum: "84 000" }), true);
    expect(sum.price.price).toBe(84_000);
    const blank = calculatorView(SITE_ENGINE, DATA, params({ mode: "sum" }), true);
    expect(blank.result).toBeNull();
    // Стёрли площадь — не подменяем 60 м², а просим стоимость.
    const erased = calculatorView(SITE_ENGINE, DATA, params({ mode: "area", area: "" }), true);
    expect(erased.price).toMatchObject({ price: null, areaM2: null, perM2: 690 });
  });

  it("100 % оплата — взнос 100; взнос ниже минимума поднимается, выше 90 — до 90", () => {
    expect(calculatorView(CABINET_ENGINE, DATA, params({ program: "full" }), true).downPct).toBe(
      100,
    );
    expect(calculatorView(CABINET_ENGINE, DATA, params({ downPct: 10 }), true).downPct).toBe(30);
    expect(calculatorView(CABINET_ENGINE, DATA, params({ downPct: 95 }), true).downPct).toBe(90);
  });

  it("чипы взноса: в кабинете у схемы — ступени со скидкой и «100%» в программу «100% оплата»", () => {
    const view = calculatorView(CABINET_ENGINE, DATA, EMPTY_CALC_PARAMS, true);
    expect(view.downOptions.map((down) => [down.downPct, down.maxMonths, down.targetId])).toEqual([
      [30, 36, null],
      [50, 18, null],
      [70, 12, null],
      [100, null, "full"],
    ]);
    const discounts = view.downOptions.map((down) =>
      downOptionDiscountPct(view.selected!, down, view.options),
    );
    expect(discounts).toEqual([0, 6, 9, 12]);
    const site = calculatorView(SITE_ENGINE, DATA, EMPTY_CALC_PARAMS, true);
    expect(site.downOptions.map((down) => down.downPct)).toEqual([30, 50, 70]);
    const bank = calculatorView(SITE_ENGINE, DATA, params({ program: "bank" }), true);
    expect(bank.downOptions.map((down) => down.downPct)).toEqual([20, 30, 50]);
  });

  it("валюта итога: выбор из адреса; без курса — только валюта расчёта", () => {
    const bank = params({ program: "bank", outCurrency: "USD" });
    expect(calculatorView(SITE_ENGINE, DATA, bank, true).outCurrency).toBe("USD");
    const noRate = calculatorView(SITE_ENGINE, { ...DATA, rate: null }, bank, true);
    expect(noRate.outCurrency).toBe("USD");
    expect(noRate.result).toEqual({ ok: false, problem: "noRate" });
    expect(calculatorView(SITE_ENGINE, DATA, params({ program: "bank" }), true).outCurrency).toBe(
      "UZS",
    );
  });

  it("сравнение — на сроке выбранной программы: банк 24 мес. → схема тоже на 24", () => {
    const view = calculatorView(SITE_ENGINE, DATA, params({ program: "bank" }), true);
    const scheme = view.comparison!.rows.find((row) => row.program === SIFAT_SCHEME)!;
    expect(scheme.calculation.months).toBe(24);
  });

  it("сравнение — все программы стоимости, «меньше платёж» и «выгоднее всего»", () => {
    const view = calculatorView(CABINET_ENGINE, DATA, params({ downPct: 50 }), true);
    const rows = view.comparison!.rows;
    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.cheapest)?.program).toBe(SIFAT_FULL);
  });
});

describe("адрес расчёта", () => {
  it("туда и обратно; пустые ключи не пишутся", () => {
    const value = params({
      developer: "demo-sifat",
      mode: "area",
      area: "64,2",
      perM2: "700",
      downPct: 50,
      months: 17,
      inCurrency: "USD",
      outCurrency: "UZS",
    });
    const search = writeCalcParams(value);
    expect(search.toString()).toBe(
      "developer=demo-sifat&mode=area&area=64%2C2&m2=700&down=50&months=17&in=USD&out=UZS",
    );
    expect(readCalcParams(search)).toEqual(value);
  });

  it("длинный slug застройщика не обрезается", () => {
    const slug = "farg-ona-sifat-qurilish-mchj-yangi-uylar-qurilish-kompaniyasi";
    expect(readCalcParams({ developer: slug }).developer).toBe(slug);
  });

  it("чужие значения — как будто ключа нет", () => {
    const read = readCalcParams({
      mode: "dacha",
      down: "95",
      months: "0",
      area: "64m",
      in: "eur",
      out: ["uzs", "usd"],
    });
    expect(read).toEqual({ ...EMPTY_CALC_PARAMS, outCurrency: "UZS" });
  });
});

describe("ссылка на расчёт", () => {
  const cases: [string, Partial<CalcParams>][] = [
    ["по умолчанию (квартира, схема)", {}],
    ["площадь × цена м² по подсказке", { mode: "area", program: "bank" }],
    ["своя площадь и срок", { mode: "area", area: "64,2", perM2: "742", months: 17 }],
    ["сумма в сумах", { mode: "sum", sum: "500 000 000", inCurrency: "UZS", program: "mortgage" }],
  ];

  it.each(cases)("%s: тот же расчёт, даже если подсказка цены м² завтра другая", (_, patch) => {
    const view = calculatorView(SITE_ENGINE, DATA, params(patch), true);
    const tomorrow = {
      ...DATA,
      stock: { ...STOCK, priceHint: { perM2: 999, currency: "USD" as const } },
    };
    const shared = calculatorView(SITE_ENGINE, tomorrow, shareParams(view, params(patch)), true);
    expect(shared.selected?.id).toBe(view.selected?.id);
    expect(shared.price.price).toBe(view.price.price);
    expect(paymentOf(shared)).toBe(paymentOf(view));
  });
});
