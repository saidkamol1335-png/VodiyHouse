import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, securityHeaders } from "./securityHeaders";

const SUPABASE = "https://abcdefgh.supabase.co";
const NONCE = "bm9uY2U=";

describe("заголовки безопасности кабинета", () => {
  it("noindex и запрет фреймов на каждом ответе; CSP — не здесь, её ставит proxy со своим nonce", () => {
    const headers = Object.fromEntries(securityHeaders().map((h) => [h.key, h.value]));
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers).not.toHaveProperty("Content-Security-Policy");
  });

  it("скрипты — только с nonce и подгруженные ими; inline без nonce запрещён, стили — нет", () => {
    const csp = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false, nonce: NONCE });
    expect(csp).toContain(`script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' https://challenges.cloudflare.com;`);
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("Supabase разрешён для API, Realtime и картинок; eval — только в разработке", () => {
    const prod = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false, nonce: NONCE });
    expect(prod).toContain(`connect-src 'self' ${SUPABASE} wss://abcdefgh.supabase.co`);
    expect(prod).toContain(`img-src 'self' blob: data: ${SUPABASE}`);
    expect(prod).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: true, nonce: NONCE })).toContain("'unsafe-eval'");
  });

  it("без адреса облака — только свой хост; nonce каждый раз новый", () => {
    expect(contentSecurityPolicy({ isDev: false, nonce: NONCE })).toContain("connect-src 'self';");
    expect(createNonce()).not.toBe(createNonce());
    expect(createNonce()).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
