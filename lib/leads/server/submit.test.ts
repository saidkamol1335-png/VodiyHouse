import { describe, expect, it } from "vitest";
import { visitorIp } from "./submit";

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
