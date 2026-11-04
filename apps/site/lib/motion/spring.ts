/**
 * Пружина framer-motion по умолчанию для type: "spring" без параметров (stiffness 100, damping 10,
 * mass 1 — заметный перелёт): шаг полунеявным Эйлером мелкими подшагами, скорость сохраняется при смене
 * цели (как у framer). Нужна там, где образец двигает элементы пружиной (Interactive Hover Links).
 */
export type Spring = {
  value: number;
  velocity: number;
  target: number;
  /** Цель сменится в этот момент (мс, performance.now) — задержка и шаг детей у framer. */
  next: { target: number; at: number } | null;
  /** Покой: |скорость| и |до цели| меньше этих порогов (framer: restSpeed / restDelta). */
  restSpeed: number;
  restDelta: number;
};

export const SPRING_DEFAULTS = { stiffness: 100, damping: 10, mass: 1 } as const;
const SUBSTEP_MS = 4;

export function createSpring(value: number, rest: "px" | "unit" = "px"): Spring {
  return {
    value,
    velocity: 0,
    target: value,
    next: null,
    restSpeed: rest === "px" ? 2 : 0.01,
    restDelta: rest === "px" ? 0.5 : 0.005,
  };
}

/** Новая цель сразу или через delayMs (отложенная перекрывает прежнюю отложенную). */
export function aimSpring(spring: Spring, target: number, now: number, delayMs = 0): void {
  if (delayMs <= 0) {
    spring.target = target;
    spring.next = null;
  } else spring.next = { target, at: now + delayMs };
}

/** Шаг на dtMs; true — ещё движется (или ждёт отложенную цель). */
export function stepSpring(spring: Spring, dtMs: number, now: number): boolean {
  if (spring.next && now >= spring.next.at) {
    spring.target = spring.next.target;
    spring.next = null;
  }
  const { stiffness, damping, mass } = SPRING_DEFAULTS;
  let left = Math.min(dtMs, 64);
  while (left > 0) {
    const step = Math.min(SUBSTEP_MS, left) / 1000;
    const force = -stiffness * (spring.value - spring.target) - damping * spring.velocity;
    spring.velocity += (force / mass) * step;
    spring.value += spring.velocity * step;
    left -= SUBSTEP_MS;
  }
  const resting = Math.abs(spring.velocity) < spring.restSpeed && Math.abs(spring.value - spring.target) < spring.restDelta;
  if (resting) {
    spring.value = spring.target;
    spring.velocity = 0;
  }
  return !resting || spring.next !== null;
}
