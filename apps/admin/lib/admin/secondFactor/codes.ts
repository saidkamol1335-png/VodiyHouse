import { createHash, randomBytes, randomInt } from "node:crypto";

// Коды второго фактора (PLAN §10, пп. 8, 28): одноразовый код входа из Telegram (6 цифр, 10 минут)
// и 10 запасных кодов «ABCD-EFGH» на случай, если Telegram недоступен. В базе — только хэши.

export const BACKUP_CODES = 10;
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const loginCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function backupCode(): string {
  const bytes = randomBytes(8);
  const chars = [...bytes].map((byte) => BACKUP_ALPHABET[byte % BACKUP_ALPHABET.length]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** Ввод человека → вид, в котором код хранится: без пробелов и дефисов, заглавными. */
export const normalizeCode = (input: string) => input.replace(/[\s-]/g, "").toUpperCase();

export const hashCode = (code: string) => createHash("sha256").update(normalizeCode(code)).digest("hex");

/** Ссылка привязки t.me/<бот>?start=h_<токен>: токен — 24 байта, в базе — хэш. */
export const linkToken = () => `h_${randomBytes(24).toString("base64url")}`;
export const LINK_TOKEN = /^h_[A-Za-z0-9_-]{32}$/;
