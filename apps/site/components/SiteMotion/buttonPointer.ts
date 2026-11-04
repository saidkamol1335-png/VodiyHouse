import { clamp, damp, type PointerEffect, type PointerFrame } from "@/lib/motion";

/** Кнопки-действия сайта, за которыми следит курсор (магнит и пламя). Кабинет — без них. */
export const TRACK_SELECTOR =
  ":root[data-surface='site'] .button:not(:disabled, .button--danger, .button--pending)";
/** Магнит — только у главной и контурной: призывы к действию, не служебные кнопки. */
const MAGNET_SELECTOR = ".button--primary, .button--outline";
/** Доля расстояния от центра кнопки до курсора и предел сдвига, px. */
const MAGNET_PULL = 0.22;
const MAGNET_LIMIT = 6;
/** Жар у края: постоянная догона (образец — 0,15 за кадр ≈ 300 мс до 95 %), ядро — быстрее. */
const EDGE_TAU_MS = 110;
const CORE_TAU_MS = 70;
const SETTLED = 0.002;
const FLAME_VARS = ["--flame-dx", "--flame-edge", "--magnet-x", "--magnet-y"];

type Flame = {
  edge: number;
  dx: number;
  targetEdge: number;
  targetDx: number;
  side: "start" | "end" | null;
  /** Сдвиг магнита — центр кнопки считаем без него, иначе кнопка «убегала» бы. */
  magnetX: number;
  magnetY: number;
  magnet: boolean;
};

function newFlame(button: HTMLElement): Flame {
  return {
    edge: 0,
    dx: 0,
    targetEdge: 0,
    targetDx: 0,
    side: null,
    magnetX: 0,
    magnetY: 0,
    magnet: button.matches(MAGNET_SELECTOR),
  };
}

/** Цель пламени и магнита по курсору над кнопкой (сила жара — pow(|t − ½|·2, 1,6), как в образце). */
function aim(frame: PointerFrame, button: HTMLElement, flame: Flame, box: DOMRect): void {
  const left = box.left - flame.magnetX;
  const top = box.top - flame.magnetY;
  const x = clamp(frame.x - left, 0, box.width);
  const t = box.width ? x / box.width : 0.5;
  flame.targetDx = x - box.width / 2;
  flame.targetEdge = Math.pow(Math.min(1, Math.abs(t - 0.5) * 2), 1.6);
  const side = t >= 0.5 ? "end" : "start";
  if (side !== flame.side) {
    flame.side = side;
    button.dataset.flameSide = side;
  }
  if (!flame.magnet) return;
  flame.magnetX = clamp((frame.x - (left + box.width / 2)) * MAGNET_PULL, -MAGNET_LIMIT, MAGNET_LIMIT);
  flame.magnetY = clamp((frame.y - (top + box.height / 2)) * MAGNET_PULL, -MAGNET_LIMIT, MAGNET_LIMIT);
  button.style.setProperty("--magnet-x", `${flame.magnetX.toFixed(2)}px`);
  button.style.setProperty("--magnet-y", `${flame.magnetY.toFixed(2)}px`);
}

function releaseMagnet(button: HTMLElement, flame: Flame): void {
  if (!flame.magnet || flame.magnetX + flame.magnetY === 0) return;
  flame.magnetX = 0;
  flame.magnetY = 0;
  button.style.removeProperty("--magnet-x");
  button.style.removeProperty("--magnet-y");
}

/** Шаг догона одной кнопки; true — ещё движется. */
function step(button: HTMLElement, flame: Flame, dt: number): boolean {
  flame.edge = damp(flame.edge, flame.targetEdge, EDGE_TAU_MS, dt);
  flame.dx = damp(flame.dx, flame.targetDx, CORE_TAU_MS, dt);
  button.style.setProperty("--flame-dx", `${flame.dx.toFixed(1)}px`);
  button.style.setProperty("--flame-edge", flame.edge.toFixed(3));
  return Math.abs(flame.edge - flame.targetEdge) > SETTLED || Math.abs(flame.dx - flame.targetDx) > 0.3;
}

/**
 * Курсор над кнопкой: ядро пламени идёт под текстом за курсором (--flame-dx), у ближнего края
 * разгорается жар (--flame-edge), кнопка тянется к курсору (--magnet-x/y). Ушёл — жар гаснет с тем
 * же догоном, переменные снимаются.
 */
export function createButtonPointer(): PointerEffect {
  const flames = new Map<HTMLElement, Flame>();
  let active: HTMLElement | null = null;
  let rect: DOMRect | null = null;
  const clear = (button: HTMLElement) => {
    for (const name of FLAME_VARS) button.style.removeProperty(name);
    delete button.dataset.flameSide;
    flames.delete(button);
  };
  return {
    read(frame) {
      const button = frame.target?.closest<HTMLElement>(TRACK_SELECTOR) ?? null;
      if (button !== active && active) {
        const left = flames.get(active);
        if (left) left.targetEdge = 0;
      }
      active = button;
      rect = button ? button.getBoundingClientRect() : null;
    },
    write(frame) {
      if (active && rect) {
        if (!flames.has(active)) flames.set(active, newFlame(active));
        aim(frame, active, flames.get(active) as Flame, rect);
      }
      let again = false;
      for (const [button, flame] of flames) {
        if (button !== active) releaseMagnet(button, flame);
        const moving = step(button, flame, frame.dt);
        if (button !== active && !moving && flame.targetEdge === 0) clear(button);
        else if (moving) again = true;
      }
      return again;
    },
    stop() {
      for (const button of [...flames.keys()]) clear(button);
      active = null;
    },
  };
}
