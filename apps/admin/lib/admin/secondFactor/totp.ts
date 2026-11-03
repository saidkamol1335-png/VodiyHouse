import { createHmac } from "node:crypto";

// TOTP (RFC 6238, SHA-1, 6 цифр, шаг 30 с) — как у фактора Supabase MFA. Сервер админки хранит
// секрет фактора и считает код сам: человек подтверждает вход кодом из Telegram (PLAN §10, п. 8).

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error("totp: не base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** Код на момент time (мс); digits — 6, как у Supabase. */
export function totp(secret: string, time: number = Date.now(), digits = 6, step = 30): string {
  const counter = Math.floor(time / 1000 / step);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}
