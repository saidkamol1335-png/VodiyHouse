import { describe, expect, it } from "vitest";
import { FrameLoader } from "./frameLoader";

/** Картинка без сети: грузится по команде теста. */
class FakeImage {
  static all: FakeImage[] = [];
  src = "";
  decoding = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeImage.all.push(this);
  }
  finish() {
    this.onload?.();
  }
}

function setup(count = 20, concurrency = 2) {
  FakeImage.all = [];
  const loadedOrder: number[] = [];
  const loader = new FrameLoader(
    count,
    (index) => `frame-${index}`,
    (index) => loadedOrder.push(index),
    concurrency,
    () => new FakeImage() as unknown as HTMLImageElement,
  );
  const requested = () => FakeImage.all.map((image) => Number(image.src.replace("frame-", "")));
  const finish = async (position: number) => {
    FakeImage.all[position]!.finish();
    await Promise.resolve();
  };
  return { loader, loadedOrder, requested, finish };
}

describe("FrameLoader", () => {
  it("грузит не больше concurrency разом; сначала черновик — каждый восьмой кадр и последний", async () => {
    const { loader, requested, finish } = setup();
    loader.start();
    expect(requested()).toEqual([0, 8]);
    await finish(0);
    expect(requested()).toEqual([0, 8, 16]);
    await finish(1);
    await finish(2);
    expect(requested()).toEqual([0, 8, 16, 19, 1]);
  });

  it("смена кадра переставляет очередь после черновика: ближайшие впереди, затем назад", async () => {
    const { loader, requested, finish } = setup(10, 1);
    loader.start();
    loader.prioritize(6);
    await finish(0);
    expect(requested()).toEqual([0, 8]);
    await finish(1);
    expect(requested()).toEqual([0, 8, 9]);
    await finish(2);
    expect(requested()).toEqual([0, 8, 9, 6]);
    await finish(3);
    expect(requested()).toEqual([0, 8, 9, 6, 7]);
    await finish(4);
    expect(requested()).toEqual([0, 8, 9, 6, 7, 5]);
  });

  it("nearest — загруженный кадр назад (и для дробного кадра), иначе вперёд, иначе ничего", async () => {
    const { loader } = setup(10, 10);
    expect(loader.nearest(5)).toBeNull();
    loader.start();
    const at = (index: number) =>
      FakeImage.all.findIndex((image) => image.src === `frame-${index}`);
    FakeImage.all[at(7)]!.finish();
    await Promise.resolve();
    expect(loader.nearest(5)?.index).toBe(7);
    FakeImage.all[at(2)]!.finish();
    await Promise.resolve();
    expect(loader.nearest(5)?.index).toBe(2);
    expect(loader.nearest(2.4)?.index).toBe(2);
    expect(loader.nearest(1)?.index).toBe(2);
  });

  it("пауза: начатые кадры докачиваются, новые ждут; start продолжает от текущего кадра", async () => {
    const { loader, loadedOrder, requested, finish } = setup(10, 1);
    loader.start();
    expect(requested()).toEqual([0]);
    loader.pause();
    await finish(0);
    expect(loadedOrder).toEqual([0]);
    expect(requested()).toEqual([0]);
    loader.prioritize(5);
    loader.start();
    expect(requested()).toEqual([0, 8]);
    await finish(1);
    await finish(2);
    expect(requested()).toEqual([0, 8, 9, 5]);
  });

  it("после destroy загрузки не отмечаются и очередь не идёт", async () => {
    const { loader, loadedOrder, finish } = setup(4, 1);
    loader.start();
    loader.destroy();
    await finish(0);
    expect(loadedOrder).toEqual([]);
    expect(FakeImage.all).toHaveLength(1);
  });
});
