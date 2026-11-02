import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./securityHeaders";

const SUPABASE = "https://abcdefgh.supabase.co";

describe("заголовки безопасности кабинета", () => {
  it("noindex, запрет фреймов и CSP на каждом ответе", () => {
    const headers = Object.fromEntries(securityHeaders({ supabaseUrl: SUPABASE, isDev: false }).map((h) => [h.key, h.value]));
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });

  it("Supabase разрешён для API, Realtime и картинок; eval — только в разработке", () => {
    const prod = contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: false });
    expect(prod).toContain(`connect-src 'self' ${SUPABASE} wss://abcdefgh.supabase.co`);
    expect(prod).toContain(`img-src 'self' blob: data: ${SUPABASE}`);
    expect(prod).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ supabaseUrl: SUPABASE, isDev: true })).toContain("'unsafe-eval'");
  });

  it("без адреса облака — только свой хост", () => {
    expect(contentSecurityPolicy({ isDev: false })).toContain("connect-src 'self';");
  });
});
