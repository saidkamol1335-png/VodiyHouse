import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSiteStock } from "./demo";
import { LIVE_READ_DEADLINE_MS, createLiveRead, readOnce } from "./readOnce";
import type { SiteStockResult } from "./siteStock";

// Одно чтение «live» всегда даёт ответ: зависшее — «нет связи» через 20 с, а не вечный «live»;
// кабинет обновили (действия старой страницы больше нет) — «обновите страницу».

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("одно чтение «live»", () => {
  it("ответ действия — как есть; не ответ — «нет связи»", async () => {
    const stock = demoSiteStock(null);
    await expect(readOnce(async () => ({ status: "done", stock }))).resolves.toEqual({
      status: "done",
      stock,
    });
    await expect(readOnce(async () => undefined as never)).resolves.toEqual({
      status: "error",
      error: "network",
    });
  });

  it("ответа нет 20 с — «нет связи»", async () => {
    const pending = readOnce(() => new Promise(() => {}));
    await vi.advanceTimersByTimeAsync(LIVE_READ_DEADLINE_MS - 1);
    let settled = false;
    void pending.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ status: "error", error: "network" });
  });

  it("пока зависшее не вернулось, новое не шлём (очередь действий Next); вернулось — снова шлём", async () => {
    let finish: (value: SiteStockResult) => void = () => {};
    const read = vi.fn(() => new Promise<SiteStockResult>((resolve) => (finish = resolve)));
    const live = createLiveRead();
    const first = live(read);
    await vi.advanceTimersByTimeAsync(LIVE_READ_DEADLINE_MS);
    await expect(first).resolves.toEqual({ status: "error", error: "network" });
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(live(read)).resolves.toEqual({ status: "error", error: "network" });
    expect(read).toHaveBeenCalledTimes(1);
    finish({ status: "done", stock: demoSiteStock(null) });
    await vi.advanceTimersByTimeAsync(0);
    const again = live(async () => ({ status: "done", stock: demoSiteStock(null) }));
    await expect(again).resolves.toMatchObject({ status: "done" });
  });

  it("обрыв — «нет связи»; действие не найдено (новая сборка) — «кабинет обновился»", async () => {
    await expect(readOnce(() => Promise.reject(new TypeError("Failed to fetch")))).resolves.toEqual(
      { status: "error", error: "network" },
    );
    await expect(
      readOnce(() => Promise.reject(new UnrecognizedActionError("Server Action not found"))),
    ).resolves.toEqual({ status: "error", error: "outdated" });
  });
});
