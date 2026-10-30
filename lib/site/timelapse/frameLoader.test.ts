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

function setup(count = 20, concurrency = 2, draftSrc?: (index: number) => string) {
  FakeImage.all = [];
  const loadedOrder: number[] = [];
  const loader = new FrameLoader(
    count,
    (index) => `frame-${index}`,
    (index) => loadedOrder.push(index),
    concurrency,
    () => new FakeImage() as unknown as HTMLImageElement,
    draftSrc,
  );
  const requested = () => FakeImage.all.map((image) => Number(image.src.replace("frame-", "")));
  const finish = async (position: number) => {
    FakeImage.all[position]!.finish();
    await Promise.resolve();
  };
  return { loader, loadedOrder, requested, finish };
}

describe("FrameLoader", () => {
  it("draftShare: доля черновика считает и не пришедшие кадры", async () => {
    const { loader } = setup(17, 4);
    const shares: number[] = [];
    loader.onDraft = (share) => shares.push(share);
    expect(loader.draftShare()).toBe(0);
    loader.load(0);
    loader.load(10);
    loader.load(16);
    loader.load(3);
    const [first, second, third, other] = FakeImage.all;
    first?.finish();
    second?.onerror?.();
    other?.finish();
    third?.finish();
    expect(shares).toEqual([1 / 3, 2 / 3, 1]);
    expect(loader.draftShare()).toBe(1);
  });

  it("грузит не больше concurrency разом; сначала черновик — каждый десятый кадр и последний", async () => {
    const { loader, requested, finish } = setup();
    loader.start();
    expect(requested()).toEqual([0, 10]);
    await finish(0);
    expect(requested()).toEqual([0, 10, 19]);
    await finish(1);
    expect(requested()).toEqual([0, 10, 19, 1]);
    await finish(2);
    expect(requested()).toEqual([0, 10, 19, 1, 2]);
  });

  it("смена кадра переставляет очередь после черновика: ближайшие впереди, затем назад", async () => {
    const { loader, requested, finish } = setup(10, 1);
    loader.start();
    loader.prioritize(6);
    await finish(0);
    expect(requested()).toEqual([0, 9]);
    await finish(1);
    expect(requested()).toEqual([0, 9, 6]);
    await finish(2);
    expect(requested()).toEqual([0, 9, 6, 7]);
    await finish(3);
    expect(requested()).toEqual([0, 9, 6, 7, 8]);
    await finish(4);
    expect(requested()).toEqual([0, 9, 6, 7, 8, 5]);
  });

  it("под экраном загрузки остальные кадры ждут весь черновик; кадр, который не придёт, очередь не держит", async () => {
    const { loader, requested, finish } = setup(20, 4);
    loader.holdForDraft = () => true;
    loader.start();
    expect(requested()).toEqual([0, 10, 19]);
    await finish(0);
    await finish(1);
    expect(requested()).toEqual([0, 10, 19]);
    FakeImage.all[2]!.onerror?.();
    expect(requested()).toEqual([0, 10, 19, 1, 2, 3, 4]);
  });

  it("экран загрузки ушёл — зависший кадр черновика очередь больше не держит", () => {
    const { loader, requested } = setup(20, 4);
    let preloading = true;
    loader.holdForDraft = () => preloading;
    loader.start();
    expect(requested()).toEqual([0, 10, 19]);
    preloading = false;
    loader.prioritize(0);
    expect(requested()).toEqual([0, 10, 19, 1]);
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
    expect(requested()).toEqual([0, 9]);
    await finish(1);
    await finish(2);
    expect(requested()).toEqual([0, 9, 5, 6]);
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

describe("FrameLoader: черновик из лёгкого набора", () => {
  const draftOf = (index: number) => `draft-${index}`;
  const urls = () => FakeImage.all.map((image) => image.src);
  const finishUrl = (url: string) => FakeImage.all.find((image) => image.src === url)!.finish();

  it("сначала весь черновик из лёгкого набора, затем все кадры настоящие — и кадры черновика тоже", async () => {
    const { loader, finish } = setup(10, 1, draftOf);
    loader.start();
    for (let position = 0; position < FakeImage.all.length; position++) await finish(position);
    expect(urls()).toEqual([
      "draft-0",
      "draft-9",
      ...Array.from({ length: 10 }, (_, index) => `frame-${index}`),
    ]);
  });

  it("настоящий кадр заменяет черновик", () => {
    const { loader } = setup(9, 4, draftOf);
    loader.load(0);
    finishUrl("draft-0");
    expect(loader.nearest(0)?.image).toBe(FakeImage.all[0]);
    loader.start();
    finishUrl("frame-0");
    const sharp = FakeImage.all.find((image) => image.src === "frame-0");
    expect(loader.nearest(0)?.image).toBe(sharp);
  });

  it("черновик, опоздавший за настоящим кадром, его не заменяет", () => {
    const { loader } = setup(9, 12, draftOf);
    loader.start();
    finishUrl("frame-8");
    const sharp = FakeImage.all.find((image) => image.src === "frame-8");
    finishUrl("draft-8");
    expect(loader.nearest(8)?.image).toBe(sharp);
  });

  it("доля черновика считает только кадры черновика: настоящие кадры её не двигают", () => {
    const { loader } = setup(9, 12, draftOf);
    const shares: number[] = [];
    loader.onDraft = (share) => shares.push(share);
    loader.start();
    finishUrl("draft-0");
    finishUrl("draft-8");
    expect(shares).toEqual([0.5, 1]);
    finishUrl("frame-0");
    finishUrl("frame-8");
    expect(shares).toEqual([0.5, 1]);
    expect(loader.draftShare()).toBe(1);
  });

  it("повторный load кадра черновика не тянет настоящий мимо очереди", () => {
    const { loader } = setup(9, 4, draftOf);
    loader.load(0);
    loader.load(0);
    expect(urls()).toEqual(["draft-0"]);
    loader.load(3);
    expect(urls()).toEqual(["draft-0", "frame-3"]);
  });

  it("черновик из того же набора — без второго запроса", () => {
    const { loader, requested } = setup(9, 9, (index) => `frame-${index}`);
    loader.start();
    expect(requested()).toEqual([0, 8, 1, 2, 3, 4, 5, 6, 7]);
  });
});
