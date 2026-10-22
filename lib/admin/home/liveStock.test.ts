import { describe, expect, it } from "vitest";
import { demoSiteStock, demoSiteStockRead } from "./demo";
import { initialLive, isSiteStockResult, nextLive, outcomeOf } from "./liveStock";

// «live» главной (Г4 A): сбой оставляет цифры и гасит метку, удачное чтение — вспышка у сменившихся.

const seed = demoSiteStock(null);
const changed = demoSiteStockRead("change")!;

describe("состояние «live»", () => {
  it("цифры страницы — live; без них (сервер не прочитал) — не live", () => {
    expect(initialLive(seed)).toMatchObject({ live: true, readAt: null, flashes: {} });
    expect(initialLive(null)).toMatchObject({ stock: null, live: false });
  });

  it("сбой: цифры те же, метка гаснет, «обновлено» — от показа страницы или прошлого чтения", () => {
    const failed = nextLive(initialLive(seed), { status: "error", error: "network" }, 9_000, 1_000);
    expect(failed).toMatchObject({ stock: seed, live: false, readAt: 1_000 });
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

  it("после чтения без прежних цифр вспышек нет", () => {
    expect(nextLive(initialLive(null), { status: "done", stock: seed }, 1, null).flashes).toEqual(
      {},
    );
  });

  it("исход: войти заново, нет прав, нет облака — стоп; база и связь — повторить", () => {
    expect(outcomeOf({ status: "done", stock: seed })).toBe("ok");
    for (const error of ["session", "forbidden", "notConfigured"] as const)
      expect(outcomeOf({ status: "error", error })).toBe("stop");
    for (const error of ["network", "unavailable"] as const)
      expect(outcomeOf({ status: "error", error })).toBe("retry");
    expect(isSiteStockResult(undefined)).toBe(false);
    expect(isSiteStockResult({ status: "done", stock: seed })).toBe(true);
  });
});
