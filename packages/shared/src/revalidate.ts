import { createHmac, timingSafeEqual } from "node:crypto";

// Сброс кэша сайта из админки (PLAN §10): POST <сайт>/api/revalidate, тело — JSON
// {now: [теги], stale: [теги]}, подпись — заголовки x-vh-timestamp (секунды Unix) и x-vh-signature
// (hex HMAC-SHA256 от «timestamp \n тело» секретом REVALIDATE_SECRET, он же — в env обоих приложений).
// now — истекают сразу («продана» не достаётся посетителю из старого кэша), stale — фоном (косметика).

export const REVALIDATE_PATH = "/api/revalidate";
export const TIMESTAMP_HEADER = "x-vh-timestamp";
export const SIGNATURE_HEADER = "x-vh-signature";
export const REVALIDATE_WINDOW_SECONDS = 300;
export const REVALIDATE_MAX_TAGS = 50;
const MIN_SECRET_LENGTH = 32;

/** Теги кэша сайта — те, что ставят его чтения (apps/site/lib/cache); остальное не принимается. */
const TAG = /^(?:complexes|developers|dictionaries|site-settings|payment-programs|showcase|(?:complex|developer|progress):[0-9a-f-]{36})$/;

export type RevalidateBody = { now: string[]; stale: string[] };

export function signRevalidate(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}\n${body}`).digest("hex");
}

export function isRevalidateSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= MIN_SECRET_LENGTH;
}

/** Подпись и окно времени; сравнение без утечки по времени. */
export function verifyRevalidate(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowSeconds: number;
}): boolean {
  const timestamp = Number(input.timestamp);
  if (!Number.isInteger(timestamp) || Math.abs(input.nowSeconds - timestamp) > REVALIDATE_WINDOW_SECONDS) return false;
  const expected = Buffer.from(signRevalidate(input.secret, timestamp, input.body), "hex");
  const given = Buffer.from(input.signature ?? "", "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Тело запроса → только известные теги, без повторов; что-то не так — null. */
export function parseRevalidateBody(body: string): RevalidateBody | null {
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const list = (value: unknown) => (Array.isArray(value) ? value : []);
  const { now, stale } = raw as { now?: unknown; stale?: unknown };
  const all = [...list(now), ...list(stale)];
  if (all.length === 0 || all.length > REVALIDATE_MAX_TAGS) return null;
  if (!all.every((tag) => typeof tag === "string" && TAG.test(tag))) return null;
  return { now: [...new Set(list(now) as string[])], stale: [...new Set(list(stale) as string[])] };
}
