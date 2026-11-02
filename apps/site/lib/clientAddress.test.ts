import { describe, expect, it } from "vitest";
import { ipv6Network, rateLimitAddress, visitorAddress } from "./clientAddress";

describe("адрес для лимитов", () => {
  it("IPv6 — одна сеть /64 на абонента: смена адреса внутри неё ключ не меняет", () => {
    const a = rateLimitAddress("2001:db8:85a3:12::1");
    expect(a).toBe("2001:db8:85a3:12::/64");
    expect(rateLimitAddress("2001:0db8:85a3:0012:ffff:abcd:1:2")).toBe(a);
    expect(rateLimitAddress("2001:DB8:85A3:12:dead:beef::")).toBe(a);
    expect(rateLimitAddress("2001:db8:85a3:13::1")).not.toBe(a);
  });

  it("сжатие :: в начале и середине; зона %eth0 отбрасывается", () => {
    expect(ipv6Network("::1")).toBe("0:0:0:0::/64");
    expect(ipv6Network("fe80::1")).toBe("fe80:0:0:0::/64");
    expect(rateLimitAddress("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("IPv4 и IPv4 внутри IPv6 — как есть", () => {
    expect(rateLimitAddress("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitAddress("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("не адрес — строка без изменений (e2e), пусто — null", () => {
    expect(rateLimitAddress("e2e-1234")).toBe("e2e-1234");
    expect(rateLimitAddress("1:2:3")).toBe("1:2:3");
    expect(rateLimitAddress("  ")).toBeNull();
    expect(rateLimitAddress(null)).toBeNull();
  });

  it("берётся только заголовок Netlify, x-forwarded-for — нет", () => {
    const headers = new Headers({ "x-forwarded-for": "198.51.100.1", "x-nf-client-connection-ip": "2001:db8::5" });
    expect(visitorAddress(headers)).toBe("2001:db8:0:0::/64");
    expect(visitorAddress(new Headers({ "x-forwarded-for": "198.51.100.1" }))).toBeNull();
  });
});
