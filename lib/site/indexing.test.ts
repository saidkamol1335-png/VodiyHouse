import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import { isIndexingClosed } from "./indexing";

describe("индексация: тестовый деплой закрыт (Ф2)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("закрыт только при SITE_NOINDEX=1", () => {
    expect(isIndexingClosed({ SITE_NOINDEX: "1" })).toBe(true);
    expect(isIndexingClosed({ SITE_NOINDEX: "0" })).toBe(false);
    expect(isIndexingClosed({})).toBe(false);
  });

  it("robots.txt: закрыт — обход открыт (noindex в заголовке виден); открыт — без кабинета и стендов", () => {
    vi.stubEnv("SITE_NOINDEX", "1");
    expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
    vi.stubEnv("SITE_NOINDEX", "");
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/dev"] },
    });
  });
});
