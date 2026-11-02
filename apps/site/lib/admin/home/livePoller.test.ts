import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_POLL_MS, LIVE_RETURN_MS, LivePoller, type LiveClock } from "./livePoller";
import type { LiveOutcome } from "./liveStock";

// Расписание «live» (Г4 A): раз в минуту, пока вкладка видна; возврат через ≥ 10 с — сразу;
// чтения не накладываются; «войдите заново» и «нет прав» останавливают.

let visible = true;
const clock: LiveClock = { now: () => Date.now(), visible: () => visible };

function poller(fresh = true, outcome: LiveOutcome = "ok", delayMs = 0) {
  const run = vi.fn(
    () => new Promise<LiveOutcome>((resolve) => setTimeout(() => resolve(outcome), delayMs)),
  );
  const instance = new LivePoller(fresh, clock);
  instance.connect(run);
  return { instance, run };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T09:00:00Z"));
  visible = true;
});
afterEach(() => vi.useRealTimers());

describe("расписание «live»", () => {
  it("свои цифры у страницы: первое чтение через минуту, дальше — раз в минуту", async () => {
    const { run } = poller();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 2);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("сервер не прочитал — читаем сразу", async () => {
    const { run } = poller(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("вкладка скрыта — не читаем; вернулись через ≥ 10 с — сразу, раньше — ждём своей минуты", async () => {
    const { instance, run } = poller();
    visible = false;
    instance.wake();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    expect(run).not.toHaveBeenCalled();
    visible = true;
    instance.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);

    visible = false;
    instance.wake();
    await vi.advanceTimersByTimeAsync(LIVE_RETURN_MS - 1_000);
    visible = true;
    instance.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS - LIVE_RETURN_MS + 1_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("медленный ответ не наслаивает чтения: следующее — через минуту после начала прошлого", async () => {
    const { instance, run } = poller(false, "ok", 15_000);
    await vi.advanceTimersByTimeAsync(5_000);
    instance.wake();
    instance.wake();
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000 + LIVE_POLL_MS - 15_000 - 1);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("«войдите заново»: по таймеру не читаем, возврат на вкладку пробует снова (вошли в другой)", async () => {
    const paused = poller(false, "pause");
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    expect(paused.run).toHaveBeenCalledTimes(1);
    paused.instance.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(paused.run).toHaveBeenCalledTimes(2);
  });

  it("кабинет обновили — стоп и при возврате; после отключения — тишина", async () => {
    const stopped = poller(false, "stop");
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    stopped.instance.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(stopped.run).toHaveBeenCalledTimes(1);

    const { instance, run } = poller();
    instance.disconnect();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 3);
    expect(run).not.toHaveBeenCalled();
  });

  it("свежие цифры страницы (вернулись ссылкой) — следующее чтение через минуту, а не сразу", async () => {
    const { instance, run } = poller();
    instance.disconnect();
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS * 2);
    instance.markFresh();
    instance.connect(run);
    await vi.advanceTimersByTimeAsync(LIVE_POLL_MS - 1);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("показ после Activity через ≥ 10 с — читаем сразу, «показано» — время первых цифр", async () => {
    const { instance, run } = poller();
    const shownAt = instance.shownAt;
    expect(shownAt).toBe(Date.now());
    instance.disconnect();
    await vi.advanceTimersByTimeAsync(LIVE_RETURN_MS);
    instance.connect(run);
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(instance.shownAt).toBe(shownAt);
  });
});
