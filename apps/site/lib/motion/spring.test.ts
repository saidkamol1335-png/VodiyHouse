import { describe, expect, it } from "vitest";
import { aimSpring, createSpring, stepSpring } from "./spring";

const run = (spring: ReturnType<typeof createSpring>, ms: number, from = 0) => {
  const values: number[] = [];
  for (let t = from; t < from + ms; t += 16) {
    stepSpring(spring, 16, t);
    values.push(spring.value);
  }
  return values;
};

describe("spring (framer: 100 / 10 / 1)", () => {
  it("перелетает цель и успокаивается на ней", () => {
    const spring = createSpring(0);
    aimSpring(spring, 16, 0);
    const values = run(spring, 3000);
    expect(Math.max(...values)).toBeGreaterThan(16 * 1.1);
    expect(values.at(-1)).toBe(16);
  });

  it("отложенная цель срабатывает в свой момент", () => {
    const spring = createSpring(0);
    aimSpring(spring, 10, 0, 250);
    run(spring, 240);
    expect(spring.value).toBe(0);
    run(spring, 600, 240);
    expect(spring.value).not.toBe(0);
  });

  it("смена цели в движении сохраняет скорость", () => {
    const spring = createSpring(0);
    aimSpring(spring, 100, 0);
    run(spring, 100);
    const velocity = spring.velocity;
    aimSpring(spring, 0, 100);
    stepSpring(spring, 1, 100);
    expect(Math.sign(spring.velocity)).toBe(Math.sign(velocity));
  });
});
