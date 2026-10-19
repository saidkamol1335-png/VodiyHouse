// Проба FPS для «кандидатов в full» (CLAUDE.md §3): ≤ 300 мс через requestAnimationFrame.

import type { MotionTier } from "./signals";

export const PROBE_DURATION_MS = 300;
/** Средний кадр длиннее 20 мс (< 50 fps) — остаёмся в lite. */
export const SLOW_FRAME_MS = 20;
/** В фоновой вкладке rAF не тикает — не ждём бесконечно. */
const PROBE_TIMEOUT_MS = 1000;

export function averageFrameMs(timestamps: readonly number[]): number {
  if (timestamps.length < 2) return Number.POSITIVE_INFINITY;
  const first = timestamps[0] as number;
  const last = timestamps[timestamps.length - 1] as number;
  return (last - first) / (timestamps.length - 1);
}

export function tierFromFrameMs(frameMs: number): Exclude<MotionTier, "none"> {
  return frameMs > SLOW_FRAME_MS ? "lite" : "full";
}

export function probeAverageFrameMs(durationMs = PROBE_DURATION_MS): Promise<number> {
  return new Promise((resolve) => {
    const timestamps: number[] = [];
    const timeout = setTimeout(() => resolve(Number.POSITIVE_INFINITY), PROBE_TIMEOUT_MS);
    const tick = (now: number) => {
      timestamps.push(now);
      if (now - (timestamps[0] as number) < durationMs) {
        requestAnimationFrame(tick);
        return;
      }
      clearTimeout(timeout);
      resolve(averageFrameMs(timestamps));
    };
    requestAnimationFrame(tick);
  });
}
