// @vitest-environment node
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authForwardingFetch,
  authForwardingOption,
  clientIpFrom,
  parseClientIp,
} from "./authForwarding";

const URL_BASE = "https://abcd.supabase.co";
const PUBLISHABLE = "sb_publishable_demo";
const SECRET = "sb_secret_demo";
const IP = "203.0.113.7";

type Sent = { url: string; headers: Headers };

/** Настоящий клиент supabase-js поверх подставного fetch: видно, что именно ушло бы в Supabase. */
function recordingClient() {
  const sent: Sent[] = [];
  const base = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    sent.push({ url: String(input), headers: new Headers(init?.headers) });
    return new Response(
      JSON.stringify({ code: 400, error_code: "invalid_credentials", msg: "x" }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
  const forwarding = authForwardingFetch({
    supabaseUrl: URL_BASE,
    publishableKey: PUBLISHABLE,
    secretKey: SECRET,
    clientIp: IP,
    fetch: base,
  });
  const client = createClient(URL_BASE, PUBLISHABLE, {
    global: { fetch: forwarding },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, sent };
}

describe("IP посетителя", () => {
  it("IPv4 и IPv6 — как есть; список — первый адрес; мусор и чужие диапазоны чисел — null", () => {
    expect(parseClientIp(IP)).toBe(IP);
    expect(parseClientIp(" 2001:db8::1 ")).toBe("2001:db8::1");
    expect(parseClientIp("198.51.100.1, 10.0.0.1")).toBe("198.51.100.1");
    expect(parseClientIp("256.1.1.1")).toBeNull();
    expect(parseClientIp("evil.example.com")).toBeNull();
    expect(parseClientIp("1.2.3.4; drop")).toBeNull();
    expect(parseClientIp("")).toBeNull();
    expect(parseClientIp(null)).toBeNull();
  });

  it("берётся только из заголовка Netlify, а не из x-forwarded-for", () => {
    expect(clientIpFrom(new Headers({ "x-forwarded-for": IP }))).toBeNull();
    expect(clientIpFrom(new Headers({ "x-nf-client-connection-ip": IP }))).toBe(IP);
  });
});

describe("пересылка IP в Auth (настоящий supabase-js)", () => {
  it("вход паролем: секретный ключ и IP посетителя", async () => {
    const { client, sent } = recordingClient();
    await client.auth.signInWithPassword({ email: "a@example.com", password: "wrong-password" });
    const token = sent.find(({ url }) => url.startsWith(`${URL_BASE}/auth/v1/token`));
    expect(token?.headers.get("apikey")).toBe(SECRET);
    expect(token?.headers.get("authorization")).toBe(`Bearer ${SECRET}`);
    expect(token?.headers.get("sb-forwarded-for")).toBe(IP);
  });

  it("свой пользователь: токен сотрудника остаётся, ключ и IP — пересылки", async () => {
    const { client, sent } = recordingClient();
    await client.auth.getUser("user.jwt.token");
    const user = sent.find(({ url }) => url === `${URL_BASE}/auth/v1/user`);
    expect(user?.headers.get("authorization")).toBe("Bearer user.jwt.token");
    expect(user?.headers.get("apikey")).toBe(SECRET);
    expect(user?.headers.get("sb-forwarded-for")).toBe(IP);
  });

  it("данные и Admin API — без секретного ключа и без IP", async () => {
    const { client, sent } = recordingClient();
    await client.from("profiles").select("id");
    await client.auth.admin.listUsers();
    const others = sent.filter(
      ({ url }) => url.includes("/rest/v1/") || url.includes("/auth/v1/admin/"),
    );
    expect(others).toHaveLength(2);
    for (const { headers } of others) {
      expect(headers.get("apikey")).toBe(PUBLISHABLE);
      expect(headers.get("authorization")).not.toContain(SECRET);
      expect(headers.has("sb-forwarded-for")).toBe(false);
    }
  });

  it("похожий адрес (/auth/v1/tokens…) не пересылается", async () => {
    const sent: string[] = [];
    const base = (async (_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      sent.push(new Headers(init?.headers).get("apikey") ?? "");
      return new Response("{}");
    }) as typeof fetch;
    const forwarding = authForwardingFetch({
      supabaseUrl: URL_BASE,
      publishableKey: PUBLISHABLE,
      secretKey: SECRET,
      clientIp: IP,
      fetch: base,
    });
    await forwarding(`${URL_BASE}/auth/v1/tokens`, { headers: { apikey: PUBLISHABLE } });
    await forwarding(`${URL_BASE}/auth/v1/.well-known/jwks.json`, {
      headers: { apikey: PUBLISHABLE },
    });
    expect(sent).toEqual([PUBLISHABLE, PUBLISHABLE]);
  });
});

describe("опция для серверных клиентов", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_BASE);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("есть IP и ключ sb_secret_ — свой fetch", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    expect(typeof authForwardingOption(IP).global?.fetch).toBe("function");
  });

  it("нет IP, нет секретного ключа или старый service_role — как раньше", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", SECRET);
    expect(authForwardingOption(null)).toEqual({});
    vi.stubEnv("SUPABASE_SECRET_KEY", "eyJhbGciOiJIUzI1NiJ9.legacy.service_role");
    expect(authForwardingOption(IP)).toEqual({});
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(authForwardingOption(IP)).toEqual({});
  });
});
