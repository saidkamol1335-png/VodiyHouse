// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSessionRefresh } from "@/lib/supabase/proxySession";

// proxy.ts целиком: сессия Supabase подменена, окружение задаётся до загрузки модуля
// (решение «кабинет без входа» считается при импорте lib/admin/access.ts).
const refresh = vi.hoisted(() => ({
  result: null as null | (() => AdminSessionRefresh),
  calls: 0,
}));
vi.mock("@/lib/supabase/proxySession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/proxySession")>()),
  refreshAdminSession: async () => {
    refresh.calls += 1;
    return refresh.result!();
  },
}));

const COOKIE = "sb-abcd-auth-token";

async function loadProxy(env: { nodeEnv: string; keys: boolean }) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env.nodeEnv);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", env.keys ? "https://abcd.supabase.co" : "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.keys ? "sb_publishable_demo" : "");
  return (await import("@/proxy")).proxy;
}

function request(path: string, init: { cookie?: string; action?: boolean } = {}) {
  const headers = new Headers();
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.action) headers.set("next-action", "abc123");
  return new NextRequest(`http://localhost:3000${path}`, {
    headers,
    method: init.action ? "POST" : "GET",
  });
}

const isRedirectTo = (response: Response, path: string) =>
  response.status === 307 && new URL(response.headers.get("location")!).pathname === path;

describe("proxy: кабинет", () => {
  beforeEach(() => {
    refresh.calls = 0;
    refresh.result = () => ({ response: NextResponse.next(), hasSession: true, transient: false });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("с ключами: без cookie сессии — 307 на вход, без запроса к Auth", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect(isRedirectTo(await proxy(request("/admin/nastroyki")), "/admin/vhod")).toBe(true);
    expect(refresh.calls).toBe(0);
  });

  it("экран входа и Server Action без cookie — пропуск", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect((await proxy(request("/admin/vhod"))).status).toBe(200);
    expect((await proxy(request("/admin", { action: true }))).status).toBe(200);
    expect(refresh.calls).toBe(0);
  });

  it("сессия истекла — 307 на вход, удаление cookie переносится на редирект", async () => {
    refresh.result = () => {
      const response = NextResponse.next();
      response.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
      return { response, hasSession: false, transient: false };
    };
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    const response = await proxy(request("/admin", { cookie: `${COOKIE}=old` }));
    expect(isRedirectTo(response, "/admin/vhod")).toBe(true);
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=;`);
  });

  it("Auth не ответил — не выкидываем на вход; есть сессия — пропуск", async () => {
    refresh.result = () => ({ response: NextResponse.next(), hasSession: false, transient: true });
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect((await proxy(request("/admin", { cookie: `${COOKIE}=x` }))).status).toBe(200);
    refresh.result = () => ({ response: NextResponse.next(), hasSession: true, transient: false });
    expect((await proxy(request("/admin", { cookie: `${COOKIE}=x` }))).status).toBe(200);
    expect(refresh.calls).toBe(2);
  });

  it("продакшен без ключей — 307 на вход; разработка без ключей — кабинет открыт", async () => {
    const production = await loadProxy({ nodeEnv: "production", keys: false });
    expect(isRedirectTo(await production(request("/admin")), "/admin/vhod")).toBe(true);
    const development = await loadProxy({ nodeEnv: "development", keys: false });
    expect((await development(request("/admin"))).status).toBe(200);
  });

  it("сайт — как раньше: / → /uz, cookie сессии кабинета не трогается", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect(isRedirectTo(await proxy(request("/")), "/uz")).toBe(true);
    const site = await proxy(request("/ru", { cookie: `${COOKIE}=x` }));
    expect(site.headers.get("set-cookie") ?? "").not.toContain("sb-");
    expect(refresh.calls).toBe(0);
  });
});
