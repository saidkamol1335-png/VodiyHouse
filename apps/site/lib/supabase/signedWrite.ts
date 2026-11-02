import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { visitorAddress } from "@/lib/clientAddress";
import { createSupabasePublicClient } from "./public";
import { hasSupabaseEnv } from "./env";

// Записи сайта без service-ключа (PLAN §10, п. 5; миграция 20261102130000): заявка, «Написать в
// Telegram» и события идут ролью посетителя в три функции базы, а сервер сайта подписывает каждый
// вызов секретом SITE_SIGNING_SECRET (тот же — в Supabase Vault, site_signing_secret). Без секрета
// база такие вызовы отклоняет — подписи нет только у прямого вызова из браузера.

const MIN_SECRET_LENGTH = 32;

export type SignedScope = "lead" | "tg-start" | "events";

function signingSecret(): string | null {
  const secret = process.env.SITE_SIGNING_SECRET;
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null;
}

/** Есть ли чем писать в базу: адрес облака, публичный ключ и секрет подписи. */
export function hasSignedWriteEnv(): boolean {
  return hasSupabaseEnv() && signingSecret() !== null;
}

/** hex(HMAC-SHA256(secret, scope \n signed_at \n payload)) — как private.verify_site_signature. */
export function signPayload(scope: SignedScope, payload: string, signedAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${scope}\n${signedAt}\n${payload}`).digest("hex");
}

export type SignedResult<T> = { data: T | null; error: { code?: string; hint?: string; message: string } | null };

/** Вызов функции site_* с подписью; payload — ровно та строка JSON, что подписана. */
export async function callSigned<T>(fn: string, scope: SignedScope, body: unknown): Promise<SignedResult<T>> {
  const secret = signingSecret();
  if (!secret || !hasSupabaseEnv()) return { data: null, error: { hint: "vh:unavailable", message: "signing not configured" } };
  const payload = JSON.stringify(body);
  const signedAt = Math.floor(Date.now() / 1000);
  const { data, error } = await createSupabasePublicClient().rpc(fn, {
    p_payload: payload,
    p_signed_at: signedAt,
    p_signature: signPayload(scope, payload, signedAt, secret),
  });
  return { data: (data ?? null) as T | null, error };
}

/** Ключ лимита частоты: хэш адреса с секретом — сам адрес посетителя в базу не попадает. */
export function rateKey(kind: "ip", value: string): string | null {
  const secret = signingSecret();
  return secret ? createHmac("sha256", secret).update(`lead-rate:${kind}:${value}`).digest("hex") : null;
}

/** Ключ лимита по адресу текущего запроса; без заголовка Netlify — null (лимит по адресу пропускается). */
export async function visitorKey(): Promise<string | null> {
  const ip = visitorAddress(await headers());
  return ip ? rateKey("ip", ip) : null;
}
