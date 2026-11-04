import { describe, expect, it } from "vitest";
import {
  EMPTY_REALTOR_PARAMS,
  readRealtorParams,
  writeRealtorParams,
} from "./realtorParams";

// Адрес риелторского калькулятора (PLAN §10, п. 48): туда и обратно без потерь, мусор — как пусто.

describe("адрес риелторского калькулятора", () => {
  it("туда и обратно: все ключи сохраняются", () => {
    const params = {
      ...EMPTY_REALTOR_PARAMS,
      tab: "afford" as const,
      priceMode: "area" as const,
      area: "64,2",
      perM2: "7 700 000",
      first: "100000000",
      monthly: "8 000 000",
      years: 20,
      months: 36,
      rate: "17.5",
      method: "differentiated" as const,
      markup: "10",
      inCurrency: "USD" as const,
      outCurrency: "UZS" as const,
    };
    expect(readRealtorParams(writeRealtorParams(params))).toEqual(params);
  });

  it("null в адрес не пишется, очищенное поле — пустой ключ; порядок постоянный", () => {
    const search = writeRealtorParams({
      ...EMPTY_REALTOR_PARAMS,
      rate: "24",
      tab: "mortgage",
      first: "",
    });
    expect(search.toString()).toBe("tab=mortgage&first=&rate=24");
    expect(readRealtorParams(search).first).toBe("");
    expect(readRealtorParams(search).sum).toBeNull();
  });

  it("чужие значения — как будто ключа нет", () => {
    const params = readRealtorParams({
      tab: "scheme",
      price: "unit",
      sum: "много",
      years: "40",
      months: "2",
      method: "tiers",
      in: "EUR",
      first: "-5",
    });
    expect(params).toEqual(EMPTY_REALTOR_PARAMS);
  });

  it("старые ссылки калькулятора застройщика не ломают расчёт: ?developer= и ?down= не читаются", () => {
    const params = readRealtorParams(new URLSearchParams("developer=myb&program=x&down=30&months=48"));
    expect(params).toEqual({ ...EMPTY_REALTOR_PARAMS, months: 48 });
  });
});
