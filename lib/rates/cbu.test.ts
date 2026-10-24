import { describe, expect, it } from "vitest";
import { CBU_USD_URL, fetchCbuUsdRate, parseCbuResponse } from "./cbu";

// Ответ cbu.uz подменён: сеть в тестах не трогаем.

const usdRow = (patch: Record<string, unknown> = {}) => ({
  id: 69,
  Code: "840",
  Ccy: "USD",
  CcyNm_RU: "Доллар США",
  Nominal: "1",
  Rate: "11808.76",
  Diff: "-12.04",
  Date: "01.10.2026",
  ...patch,
});

const respond = (body: unknown, status = 200): typeof fetch =>
  (async () => new Response(JSON.stringify(body), { status })) as typeof fetch;

describe("курс ЦБ", () => {
  it("доллар из ответа: курс числом, дата ISO", () => {
    expect(parseCbuResponse([usdRow()])).toEqual({ usdUzs: 11808.76, date: "2026-10-01" });
  });

  it("номинал и запятая в курсе учитываются", () => {
    expect(parseCbuResponse([usdRow({ Rate: "118087,6", Nominal: "10" })])).toEqual({
      usdUzs: 11808.76,
      date: "2026-10-01",
    });
  });

  it("чужой формат, нет доллара, странная дата или курс вне пределов — null", () => {
    expect(parseCbuResponse({ Rate: "11808.76" })).toBeNull();
    expect(parseCbuResponse([usdRow({ Ccy: "EUR" })])).toBeNull();
    expect(parseCbuResponse([usdRow({ Date: "2026-10-01" })])).toBeNull();
    expect(parseCbuResponse([usdRow({ Rate: "abc" })])).toBeNull();
    expect(parseCbuResponse([usdRow({ Rate: "118.08" })])).toBeNull();
    expect(parseCbuResponse([usdRow({ Nominal: "0" })])).toBeNull();
  });

  it("загрузка: адрес ЦБ, ответ разобран; не 200 и чужой ответ — ошибка с причиной", async () => {
    let requested = "";
    const spy = (async (url: string) => {
      requested = url;
      return new Response(JSON.stringify([usdRow()]));
    }) as unknown as typeof fetch;
    expect(await fetchCbuUsdRate(spy)).toEqual({ usdUzs: 11808.76, date: "2026-10-01" });
    expect(requested).toBe(CBU_USD_URL);
    await expect(fetchCbuUsdRate(respond([], 503))).rejects.toThrow("503");
    await expect(fetchCbuUsdRate(respond([]))).rejects.toThrow("неожиданном");
  });
});
