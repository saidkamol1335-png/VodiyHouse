// @vitest-environment node
import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/proxy";
import { copySessionCookies, refreshAdminSession } from "./proxySession";

type CookieWrite = { name: string; value: string; options: Record<string, unknown> };
type SetAll = (cookies: CookieWrite[], headers: Record<string, string>) => void;

// Подмена клиента: getClaims ведёт себя как настоящий при обновлении токена — пишет cookie через setAll.
const claims = vi.hoisted(() => ({
  run: (async () => ({ data: null, error: null })) as (setAll: SetAll) => Promise<unknown>,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: { setAll: SetAll } }) => ({
    auth: { getClaims: () => claims.run(options.cookies.setAll) },
  }),
}));

const NO_STORE = { "cache-control": "private, no-cache, no-store, must-revalidate, max-age=0", expires: "0", pragma: "no-cache" };
const request = () =>
  new NextRequest("http://localhost:3000/admin/nastroyki", { headers: { cookie: "sb-abcd-auth-token=old" } });

describe("сессия кабинета в proxy", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("обновлённая cookie — и в ответе браузеру, и в запросе для страницы; заголовки «не кэшировать»", async () => {
    claims.run = async (setAll) => {
      setAll([{ name: "sb-abcd-auth-token", value: "new", options: { path: "/", sameSite: "lax" } }], NO_STORE);
      return { data: { claims: { sub: "user-1" } }, error: null };
    };
    const incoming = request();
    const { response, hasSession, transient } = await refreshAdminSession(incoming);
    expect(hasSession).toBe(true);
    expect(transient).toBe(false);
    expect(response.cookies.get("sb-abcd-auth-token")?.value).toBe("new");
    expect(incoming.cookies.get("sb-abcd-auth-token")?.value).toBe("new");
    expect(response.headers.get("x-middleware-request-cookie")).toContain("sb-abcd-auth-token=new");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("нет сессии → hasSession false; сбой сети Auth → transient", async () => {
    claims.run = async () => ({ data: null, error: null });
    expect(await refreshAdminSession(request())).toMatchObject({ hasSession: false, transient: false });
    claims.run = async () => ({ data: null, error: new AuthRetryableFetchError("сбой", 503) });
    expect(await refreshAdminSession(request())).toMatchObject({ hasSession: false, transient: true });
  });

  it("copySessionCookies переносит cookie и заголовки на редирект", () => {
    const from = NextResponse.next();
    from.cookies.set("sb-abcd-auth-token", "", { maxAge: 0, path: "/" });
    for (const [key, value] of Object.entries(NO_STORE)) from.headers.set(key, value);
    const redirect = copySessionCookies(from, NextResponse.redirect(new URL("http://localhost:3000/admin/vhod")));
    expect(redirect.cookies.get("sb-abcd-auth-token")?.value).toBe("");
    expect(redirect.headers.get("cache-control")).toContain("no-store");
    expect(redirect.headers.get("expires")).toBe("0");
  });

  it("matcher proxy: страницы — да; статика Next.js и файлы с расширением — нет", () => {
    const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });
    expect(matches("/admin/nastroyki")).toBe(true);
    expect(matches("/uz")).toBe(true);
    expect(matches("/_next/static/chunks/a.js")).toBe(false);
    expect(matches("/admin/logo.png")).toBe(false);
  });
});
