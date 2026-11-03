// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminSessionRefresh } from "@/lib/supabase/proxySession";

// proxy.ts целиком: сессия Supabase подменена, окружение задаётся до загрузки модуля
// (решение «кабинет без входа» считается при импорте lib/admin/access.ts).
const refresh = vi.hoisted(() => ({
  result: null as null | ((request: NextRequest) => AdminSessionRefresh),
  calls: 0,
}));
vi.mock("@/lib/supabase/proxySession", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/supabase/proxySession")>()),
  refreshAdminSession: async (request: NextRequest) => {
    refresh.calls += 1;
    return refresh.result!(request);
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
  return new NextRequest(`http://localhost:3000${path}`, { headers, method: init.action ? "POST" : "GET" });
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
    expect(isRedirectTo(await proxy(request("/nastroyki")), "/vhod")).toBe(true);
    expect(refresh.calls).toBe(0);
  });

  it("ссылка на заявку без сессии — вход запоминает адрес возврата; главная кабинета — нет", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    const response = await proxy(request("/zayavki/1045"));
    expect(isRedirectTo(response, "/vhod")).toBe(true);
    expect(response.cookies.get("vh-return")).toMatchObject({ value: "/zayavki/1045", httpOnly: true, path: "/" });
    expect((await proxy(request("/"))).cookies.get("vh-return")).toBeUndefined();
    // Файл и предзагрузка — не адрес возврата.
    expect((await proxy(request("/zayavki/csv"))).cookies.get("vh-return")).toBeUndefined();
    const prefetch = new NextRequest("http://localhost:3000/zhk", { headers: { "next-router-prefetch": "1", rsc: "1" } });
    expect((await proxy(prefetch)).cookies.get("vh-return")).toBeUndefined();
  });

  it("экран входа и Server Action без cookie — пропуск", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect((await proxy(request("/vhod"))).status).toBe(200);
    expect((await proxy(request("/", { action: true }))).status).toBe(200);
    expect(refresh.calls).toBe(0);
  });

  it("сессия истекла — 307 на вход, удаление cookie переносится на редирект", async () => {
    refresh.result = () => {
      const response = NextResponse.next();
      response.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
      return { response, hasSession: false, transient: false };
    };
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    const response = await proxy(request("/", { cookie: `${COOKIE}=old` }));
    expect(isRedirectTo(response, "/vhod")).toBe(true);
    expect(response.headers.get("set-cookie")).toContain(`${COOKIE}=;`);
  });

  it("Auth не ответил — не выкидываем на вход; есть сессия — пропуск", async () => {
    refresh.result = () => ({ response: NextResponse.next(), hasSession: false, transient: true });
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    expect((await proxy(request("/", { cookie: `${COOKIE}=x` }))).status).toBe(200);
    refresh.result = () => ({ response: NextResponse.next(), hasSession: true, transient: false });
    expect((await proxy(request("/", { cookie: `${COOKIE}=x` }))).status).toBe(200);
    expect(refresh.calls).toBe(2);
  });

  it("метка сотрудника для сайта: есть сессия без метки — ставим; метка есть, сбой Auth — не трогаем", async () => {
    const proxy = await loadProxy({ nodeEnv: "development", keys: true });
    const marked = await proxy(request("/", { cookie: `${COOKIE}=x` }));
    expect(marked.headers.get("set-cookie") ?? "").toMatch(/vh-staff=1; Path=\/;.*Max-Age=\d+;.*SameSite=lax/i);
    expect(marked.headers.get("set-cookie") ?? "").not.toMatch(/Domain=|HttpOnly/i);
    const again = await proxy(request("/", { cookie: `${COOKIE}=x; vh-staff=1` }));
    expect(again.headers.get("set-cookie") ?? "").not.toContain("vh-staff");
    refresh.result = () => ({ response: NextResponse.next(), hasSession: false, transient: true });
    const transient = await proxy(request("/", { cookie: `${COOKIE}=x` }));
    expect(transient.headers.get("set-cookie") ?? "").not.toContain("vh-staff");
  });

  it("CSP с nonce (фаза F): на каждом ответе — и вход, и кабинет, и редирект, и /dev, /api; nonce каждый раз новый", async () => {
    const proxy = await loadProxy({ nodeEnv: "production", keys: true });
    const responses = [
      await proxy(request("/vhod")),
      await proxy(request("/", { cookie: `${COOKIE}=x` })),
      await proxy(request("/zayavki")),
      await proxy(request("/dev/zhk")),
      await proxy(request("/api/cron/leads")),
    ];
    const nonces = responses.map((response) => {
      const policy = response.headers.get("content-security-policy") ?? "";
      expect(policy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
      return /'nonce-([^']+)'/.exec(policy)![1];
    });
    expect(new Set(nonces).size).toBe(nonces.length);
    // Страница получает nonce в заголовках запроса (x-middleware-request-*) — тот же, что в ответе.
    const page = await proxy(request("/vhod"));
    const nonce = /'nonce-([^']+)'/.exec(page.headers.get("content-security-policy")!)![1];
    expect(page.headers.get("x-middleware-request-x-nonce")).toBe(nonce);
    expect(page.headers.get("x-middleware-request-content-security-policy")).toContain(`'nonce-${nonce}'`);
  });

  it("обновлённый токен сессии доходит до страницы вместе с nonce", async () => {
    refresh.result = (incoming) => {
      incoming.cookies.set(COOKIE, "fresh");
      return { response: NextResponse.next({ request: incoming }), hasSession: true, transient: false };
    };
    const proxy = await loadProxy({ nodeEnv: "production", keys: true });
    const response = await proxy(request("/", { cookie: `${COOKIE}=stale` }));
    expect(response.headers.get("x-middleware-request-cookie")).toContain(`${COOKIE}=fresh`);
    expect(response.headers.get("x-middleware-request-x-nonce")).toBeTruthy();
  });

  it("продакшен без ключей — 307 на вход; разработка без ключей — кабинет открыт", async () => {
    const production = await loadProxy({ nodeEnv: "production", keys: false });
    expect(isRedirectTo(await production(request("/")), "/vhod")).toBe(true);
    const development = await loadProxy({ nodeEnv: "development", keys: false });
    expect((await development(request("/"))).status).toBe(200);
  });

  // Проект-2: языков в админке нет; стенды /dev и /api proxy не трогает — ни редиректа, ни сессии.
  it("стенды /dev и /api — мимо гейта и без обновления сессии", async () => {
    const proxy = await loadProxy({ nodeEnv: "production", keys: true });
    for (const path of ["/dev/zhk", "/api/cron/leads"]) {
      const response = await proxy(request(path, { cookie: `${COOKIE}=x` }));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("set-cookie") ?? "").not.toContain("sb-");
    }
    expect(refresh.calls).toBe(0);
  });
});
