import { describe, expect, it } from "vitest";
import { ReadQueue } from "./readQueue";

/** Обещание, которое тест выполняет сам. */
function deferred() {
  let resolve!: (read: boolean) => void;
  const promise = new Promise<boolean>((done) => (resolve = done));
  return { promise, resolve };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("очередь чтения списка квартир", () => {
  it("пока сохраняется статус — не читает; после — одно чтение на все просьбы", async () => {
    const queue = new ReadQueue();
    let reads = 0;
    queue.connect(async () => {
      reads += 1;
      return true;
    });
    const saving = deferred();
    const tap = queue.track(() => saving.promise);
    const first = queue.reload();
    const second = queue.reload();
    await tick();
    expect(reads).toBe(0);
    saving.resolve(true);
    await tap;
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(reads).toBe(1);
  });

  it("просьба во время чтения — ещё одно чтение после него, обещание ждёт именно его", async () => {
    const queue = new ReadQueue();
    const reads: Array<ReturnType<typeof deferred>> = [];
    queue.connect(() => {
      const read = deferred();
      reads.push(read);
      return read.promise;
    });
    void queue.reload();
    await tick();
    let second: boolean | null = null;
    void queue.reload().then((read) => (second = read));
    reads[0]!.resolve(true);
    await tick();
    expect(reads).toHaveLength(2);
    expect(second).toBeNull();
    reads[1]!.resolve(false);
    await tick();
    expect(second).toBe(false);
  });

  it("без подключения просьбы ждут; упавшее чтение — false, очередь идёт дальше", async () => {
    const queue = new ReadQueue();
    const waiting = queue.reload();
    let reads = 0;
    queue.connect(async () => {
      reads += 1;
      if (reads === 1) throw new Error("сбой");
      return true;
    });
    expect(await waiting).toBe(false);
    expect(await queue.reload()).toBe(true);
    expect(reads).toBe(2);
  });
});
