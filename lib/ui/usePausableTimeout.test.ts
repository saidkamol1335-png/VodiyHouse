import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PausableTimer } from "./usePausableTimeout";

describe("таймер с паузой", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("пауза останавливает отсчёт, остаток идёт после неё; пока есть хоть одна причина — стоит", () => {
    const expire = vi.fn();
    const timer = new PausableTimer(expire);
    timer.start(5000);
    vi.advanceTimersByTime(3000);
    timer.pause("hover");
    timer.pause("focus");
    vi.advanceTimersByTime(60_000);
    timer.resume("hover");
    vi.advanceTimersByTime(60_000);
    expect(expire).not.toHaveBeenCalled();
    timer.resume("focus");
    vi.advanceTimersByTime(1999);
    expect(expire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it("новый старт — отсчёт заново; отмена — без срабатывания", () => {
    const expire = vi.fn();
    const timer = new PausableTimer(expire);
    timer.start(5000);
    vi.advanceTimersByTime(4000);
    timer.start(5000);
    vi.advanceTimersByTime(4000);
    timer.cancel();
    timer.resume("hover");
    vi.advanceTimersByTime(10_000);
    expect(expire).not.toHaveBeenCalled();
  });
});
