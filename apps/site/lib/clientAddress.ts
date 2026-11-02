import { CLIENT_IP_HEADER } from "@/lib/supabase/authForwarding";

// Адрес посетителя для лимитов частоты: заявки, бот, события, вход в кабинет. Только заголовок
// Netlify (его ставит край сети): x-forwarded-for и x-real-ip посетитель подделывает.
// Аудит 29.10: у IPv6 провайдер выдаёт абоненту целую сеть /64, и смена адреса внутри неё давала
// новый ключ — лимит обходился. Поэтому IPv6 сводится к префиксу /64; IPv4 и IPv4 внутри IPv6
// (::ffff:1.2.3.4) — как есть. Не адрес (e2e дают каждому тесту свой «адрес») — строка без изменений:
// она идёт только в хэш.

const HEX_GROUP = /^[0-9a-f]{1,4}$/;
const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/;

/** «2001:db8:1:2::/64» для любого адреса этой сети; null — не IPv6. */
export function ipv6Network(ip: string): string | null {
  const parts = ip.toLowerCase().split("::");
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if (parts.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(parts.length === 2 ? missing : 0).fill("0"), ...right];
  if (!groups.every((group) => HEX_GROUP.test(group))) return null;
  return `${groups.slice(0, 4).map((group) => parseInt(group, 16).toString(16)).join(":")}::/64`;
}

/** Ключевая часть адреса для лимита; null — заголовка нет (база пропускает лимит по адресу). */
export function rateLimitAddress(raw: string | null | undefined): string | null {
  const value = raw?.split("%")[0]?.trim();
  if (!value) return null;
  const mapped = MAPPED_V4.exec(value.toLowerCase());
  if (mapped) return mapped[1]!;
  return value.includes(":") ? (ipv6Network(value) ?? value) : value;
}

export function visitorAddress(headers: Pick<Headers, "get">): string | null {
  return rateLimitAddress(headers.get(CLIENT_IP_HEADER));
}
