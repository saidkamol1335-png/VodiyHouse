import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSupabaseAdminEnv, hasSupabaseEnv, supabasePublicEnv, supabaseSecretKey } from "./env";

describe("переменные Supabase", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("читает URL и публичный ключ", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
    expect(supabasePublicEnv()).toEqual({
      url: "https://demo.supabase.co",
      publishableKey: "sb_publishable_demo",
    });
  });

  it("без ключа — понятная ошибка с подсказкой про .env.local", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => supabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.*\.env\.local/);
  });

  it("секретный ключ обязателен для admin-клиента", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(() => supabaseSecretKey()).toThrow(/SUPABASE_SECRET_KEY/);
  });

  it("hasSupabaseEnv: false без адреса, без ключа и при пустых строках; true с обоими", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
    expect(hasSupabaseEnv()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(hasSupabaseEnv()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
    expect(hasSupabaseEnv()).toBe(true);
  });

  it("hasSupabaseAdminEnv требует ещё SUPABASE_SECRET_KEY", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://demo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_demo");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(hasSupabaseAdminEnv()).toBe(false);
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_demo");
    expect(hasSupabaseAdminEnv()).toBe(true);
  });
});
