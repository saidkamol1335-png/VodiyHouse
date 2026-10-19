import { afterEach, describe, expect, it, vi } from "vitest";
import { supabasePublicEnv, supabaseSecretKey } from "./env";

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
});
