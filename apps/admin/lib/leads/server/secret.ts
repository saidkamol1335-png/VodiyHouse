import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Секрет из заголовка без утечки по времени. Длины — в байтах: не-ASCII заголовок той же длины в
 *  символах — просто «не тот», а не исключение timingSafeEqual. */
export function sameSecret(given: string, secret: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
