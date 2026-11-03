import { describe, expect, it } from "vitest";
import { backupCode, hashCode, LINK_TOKEN, linkToken, loginCode, normalizeCode } from "./codes";
import { base32Decode, totp } from "./totp";

// RFC 6238, приложение B: секрет «12345678901234567890» (base32 — GEZDGNBV…), SHA-1, 8 цифр.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP для фактора Supabase", () => {
  it("совпадает с векторами RFC 6238", () => {
    expect(base32Decode(RFC_SECRET).toString()).toBe("12345678901234567890");
    expect(totp(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(totp(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totp(RFC_SECRET, 20_000_000_000_000, 8)).toBe("65353130");
    expect(totp(RFC_SECRET, 59_000)).toBe("287082");
  });
});

describe("коды второго фактора", () => {
  it("код входа — 6 цифр, запасной — ABCD-EFGH без похожих букв, ссылка привязки — h_ и 32 знака", () => {
    expect(loginCode()).toMatch(/^\d{6}$/);
    expect(backupCode()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(linkToken()).toMatch(LINK_TOKEN);
  });

  it("хэш не зависит от пробелов, дефиса и регистра ввода", () => {
    expect(normalizeCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(hashCode("abcd efgh")).toBe(hashCode("ABCD-EFGH"));
    expect(hashCode("123456")).not.toBe(hashCode("123457"));
  });
});
