import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { visitorAddress as visitorIp } from "@/lib/clientAddress";
import { signPayload } from "./signedWrite";

// Адрес для лимитов «5 заявок с адреса», кодов бота и событий: подделанный заголовок не должен
// давать посетителю новый лимит на каждый запрос.

const IP = "203.0.113.7";

describe("адрес посетителя для лимитов", () => {
  it("берётся из заголовка Netlify", () => {
    expect(visitorIp(new Headers({ "x-nf-client-connection-ip": ` ${IP} ` }))).toBe(IP);
  });

  it("x-forwarded-for и x-real-ip не берутся — их подделывает посетитель", () => {
    expect(visitorIp(new Headers({ "x-forwarded-for": IP, "x-real-ip": IP }))).toBeNull();
    const both = new Headers({ "x-nf-client-connection-ip": IP, "x-forwarded-for": "198.51.100.1" });
    expect(visitorIp(both)).toBe(IP);
  });

  it("пустой заголовок — адреса нет", () => {
    expect(visitorIp(new Headers({ "x-nf-client-connection-ip": "  " }))).toBeNull();
    expect(visitorIp(new Headers())).toBeNull();
  });
});

// Подпись должна совпасть с private.verify_site_signature (20261102130000): тот же порядок частей.
describe("подпись записей сайта", () => {
  it("hex HMAC-SHA256 от «scope, signed_at, payload» через перевод строки", () => {
    const secret = "s".repeat(40);
    const payload = JSON.stringify({ lead: { phone: "+998901112233" } });
    const expected = createHmac("sha256", secret).update(["lead", "1700000000", payload].join("\n")).digest("hex");
    expect(signPayload("lead", payload, 1_700_000_000, secret)).toBe(expected);
    expect(signPayload("events", payload, 1_700_000_000, secret)).not.toBe(expected);
  });
});
