import { describe, expect, it } from "vitest";
import { demoSiteStock, demoSiteStockRead } from "./demo";
import { initialLive, isSiteStockResult, nextLive, outcomeOf, withoutFlashes } from "./liveStock";
import type { SiteStock, SiteStockResult } from "./siteStock";

/** Ответ DEMO-чтения — цифры (сценарий без отказа). */
function demoStock(result: SiteStockResult): SiteStock {
  if (result.status !== "done") throw new Error(result.error);
  return result.stock;
}

// «live» главной (Г4 A): сбой оставляет цифры и гасит метку, удачное чтение — вспышка у сменившихся;
// сессия, права и обновление кабинета — остановка с причиной, а не «попробуем снова».

const seed = demoSiteStock(null);
const changed = demoStock(demoSiteStockRead("change"));

describe("состояние «live»", () => {
  it("цифры страницы — live; без них (сервер не прочитал) — не live", () => {
    expect(initialLive(seed)).toMatchObject({
      live: true,
      readAt: null,
      flashes: {},
      halted: null,
    });
    expect(initialLive(null)).toMatchObject({ stock: null, live: false });
  });

  it("сбой: цифры те же, метка гаснет, «обновлено» — от показа страницы или прошлого чтения", () => {
    const failed = nextLive(initialLive(seed), { status: "error", error: "network" }, 9_000, 1_000);
    expect(failed).toMatchObject({ stock: seed, live: false, readAt: 1_000, halted: null });
    const read = nextLive(initialLive(seed), { status: "done", stock: seed }, 5_000, 1_000);
    expect(nextLive(read, { status: "error", error: "unavailable" }, 9_000, 1_000).readAt).toBe(
      5_000,
    );
  });

  it("вспышка — только у ЖК, где сменилась пилюля; повтор — следующий номер", () => {
    const once = nextLive(initialLive(seed), { status: "done", stock: changed }, 2_000, 1_000);
    const [shodlik, , , orzu] = changed.complexes;
    expect(once.flashes).toEqual({ [shodlik!.id]: 1, [orzu!.id]: 1 });
    expect(once).toMatchObject({ live: true, readAt: 2_000 });
    const back = nextLive(once, { status: "done", stock: seed }, 3_000, 1_000);
    expect(back.flashes).toEqual({ [shodlik!.id]: 2, [orzu!.id]: 2 });
    expect(nextLive(back, { status: "done", stock: seed }, 4_000, 1_000).flashes).toEqual(
      back.flashes,
    );
  });

  it("страницу спрятали (Activity) — прошлые вспышки гаснут, следующая перемена снова вспыхнет", () => {
    const once = nextLive(initialLive(seed), { status: "done", stock: changed }, 2_000, 1_000);
    const hidden = withoutFlashes(once);
    expect(hidden.flashes).toEqual({});
    expect(withoutFlashes(hidden)).toBe(hidden);
    const again = nextLive(hidden, { status: "done", stock: seed }, 3_000, 1_000);
    expect(Object.values(again.flashes)).toEqual([1, 1]);
  });

  it("после чтения без прежних цифр вспышек нет", () => {
    expect(nextLive(initialLive(null), { status: "done", stock: seed }, 1, null).flashes).toEqual(
      {},
    );
  });

  it("исход: сессия, права, облако — пауза с причиной; кабинет обновили — стоп; база и связь — повторить", () => {
    expect(outcomeOf({ status: "done", stock: seed })).toBe("ok");
    for (const error of ["session", "forbidden", "notConfigured"] as const) {
      expect(outcomeOf({ status: "error", error })).toBe("pause");
      expect(nextLive(initialLive(seed), { status: "error", error }, 2, 1).halted).toBe(error);
    }
    expect(outcomeOf({ status: "error", error: "outdated" })).toBe("stop");
    for (const error of ["network", "unavailable"] as const) {
      expect(outcomeOf({ status: "error", error })).toBe("retry");
      expect(nextLive(initialLive(seed), { status: "error", error }, 2, 1).halted).toBeNull();
    }
    const halted = nextLive(initialLive(seed), { status: "error", error: "session" }, 2, 1);
    expect(nextLive(halted, { status: "done", stock: seed }, 3, 1).halted).toBeNull();
    expect(isSiteStockResult(undefined)).toBe(false);
    expect(isSiteStockResult({ status: "done", stock: seed })).toBe(true);
  });
});
