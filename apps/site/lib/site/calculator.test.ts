import { beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOG_TAG, DEVELOPERS_TAG, PROGRAMS_TAG } from "@/lib/cache";

// Пункт «Калькулятор» в меню (решение «Пустые состояния», приёмка 2.9): прячется, только когда
// база ответила «застройщиков с программами нет»; кэш — с узкими тегами, без каталога.
// Облако, база и кэш Next — заглушки.

const cloud = vi.hoisted(() => ({
  env: true,
  answer: { data: true as unknown, error: null as unknown },
  calls: [] as string[],
  tags: [] as string[],
}));

vi.mock("next/cache", () => ({
  cacheLife: () => {},
  cacheTag: (...tags: string[]) => cloud.tags.push(...tags),
  revalidateTag: () => {},
  updateTag: () => {},
}));
vi.mock("@/lib/supabase/env", () => ({ hasSupabaseEnv: () => cloud.env }));
vi.mock("@/lib/supabase/public", () => ({
  createSupabasePublicClient: () => ({
    rpc: async (name: string) => {
      cloud.calls.push(name);
      return cloud.answer;
    },
  }),
}));

const { readCalculatorInMenu } = await import("./calculator");

beforeEach(() => {
  cloud.env = true;
  cloud.answer = { data: true, error: null };
  cloud.calls = [];
  cloud.tags = [];
});

describe("пункт «Калькулятор» в меню", () => {
  it("база ответила: есть программы — пункт есть, нет — пункта нет", async () => {
    expect(await readCalculatorInMenu()).toBe(true);
    cloud.answer = { data: false, error: null };
    expect(await readCalculatorInMenu()).toBe(false);
    expect(cloud.calls).toEqual(["site_calculator_available", "site_calculator_available"]);
  });

  it("не знаем — пункт остаётся: облака нет (базу не спрашиваем) или база не ответила", async () => {
    cloud.env = false;
    expect(await readCalculatorInMenu()).toBe(true);
    expect(cloud.calls).toEqual([]);
    cloud.env = true;
    cloud.answer = { data: null, error: { message: "PGRST202" } };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await readCalculatorInMenu()).toBe(true);
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("кэш — по программам и застройщикам, не по каталогу: продажа квартиры меню не сбрасывает", async () => {
    await readCalculatorInMenu();
    expect(cloud.tags).toEqual([PROGRAMS_TAG, DEVELOPERS_TAG]);
    expect(cloud.tags).not.toContain(CATALOG_TAG);
  });
});
