import { afterEach, describe, expect, it, vi } from "vitest";
import { requestPointerFrame, subscribePointer } from "./pointerHub";

afterEach(() => vi.unstubAllGlobals());

function stubFrames() {
  const queue: FrameRequestCallback[] = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => queue.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => queue.splice(0));
  return (time: number) => queue.splice(0).forEach((callback) => callback(time));
}

describe("pointerHub", () => {
  it("в кадре сначала все read, потом все write; один кадр на несколько движений", () => {
    const run = stubFrames();
    const log: string[] = [];
    const offA = subscribePointer({ read: () => log.push("read a"), write: () => void log.push("write a") });
    const offB = subscribePointer({ read: () => log.push("read b"), write: () => void log.push("write b") });
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 10, clientY: 20, pointerType: "mouse" }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 12, clientY: 20, pointerType: "mouse" }));
    run(100);
    expect(log).toEqual(["read a", "read b", "write a", "write b"]);
    offA();
    offB();
  });

  it("касание не двигает курсор; кадр повторяется, пока write просит; без подписчиков — тишина", () => {
    const run = stubFrames();
    const xs: number[] = [];
    let left = 2;
    const off = subscribePointer({
      read: (frame) => xs.push(frame.x),
      write: () => (left -= 1) > 0,
    });
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: 99, pointerType: "touch" }));
    requestPointerFrame();
    run(16);
    run(32);
    run(48);
    expect(xs).toHaveLength(2);
    expect(xs).not.toContain(99);
    off();
  });
});
