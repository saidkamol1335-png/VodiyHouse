import type { DeveloperSummary } from "@/lib/site/developers/records";

/** С какого числа логотипов строка бежит (правки 15.11, п. 27): меньше — статичный ряд. */
export const MARQUEE_MIN_LOGOS = 5;

export type MarqueeMode = "none" | "static" | "running";

/** Застройщики с логотипом — в порядке руководителя (site_developers: sort, name). */
export function marqueeLogos(developers: readonly DeveloperSummary[] | null): DeveloperSummary[] {
  return (developers ?? []).filter((developer) => developer.logo !== null);
}

export function marqueeMode(count: number): MarqueeMode {
  if (count === 0) return "none";
  return count >= MARQUEE_MIN_LOGOS ? "running" : "static";
}
