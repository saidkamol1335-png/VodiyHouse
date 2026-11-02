import { describe, expect, it } from "vitest";
import { parseRevalidateBody, signRevalidate, verifyRevalidate } from "./revalidate";

const SECRET = "r".repeat(40);
const ID = "11111111-2222-4333-8444-555555555555";

describe("сброс кэша сайта из админки", () => {
  it("подпись сходится только с тем же телом, секретом и временем в окне 5 минут", () => {
    const body = JSON.stringify({ now: [`complex:${ID}`, "complexes"], stale: [] });
    const signature = signRevalidate(SECRET, 1_700_000_000, body);
    const check = (patch: Partial<Parameters<typeof verifyRevalidate>[0]>) =>
      verifyRevalidate({ secret: SECRET, timestamp: "1700000000", signature, body, nowSeconds: 1_700_000_100, ...patch });
    expect(check({})).toBe(true);
    expect(check({ body: body.replace("complexes", "showcase") })).toBe(false);
    expect(check({ secret: "x".repeat(40) })).toBe(false);
    expect(check({ nowSeconds: 1_700_000_400 })).toBe(false);
    expect(check({ signature: null })).toBe(false);
    expect(check({ timestamp: "abc" })).toBe(false);
  });

  it("принимаются только теги сайта, без повторов; пустое и лишнее — отказ", () => {
    expect(parseRevalidateBody(JSON.stringify({ now: ["complexes", "complexes"], stale: [`developer:${ID}`] }))).toEqual({
      now: ["complexes"],
      stale: [`developer:${ID}`],
    });
    expect(parseRevalidateBody(JSON.stringify({ now: ["admin-secret"] }))).toBeNull();
    expect(parseRevalidateBody(JSON.stringify({ now: [] }))).toBeNull();
    expect(parseRevalidateBody("не json")).toBeNull();
    expect(parseRevalidateBody(JSON.stringify({ now: Array.from({ length: 51 }, () => "complexes") }))).toBeNull();
  });
});
