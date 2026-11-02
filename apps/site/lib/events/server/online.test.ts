import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({ rpc }) }));
vi.mock("@/lib/supabase/env", () => ({ hasSupabaseAdminEnv: () => true }));

describe("посетители онлайн для «Выбрать квартиру»", () => {
  beforeEach(() => {
    rpc.mockReset();
    vi.resetModules();
  });

  it("ответ базы держится 30 с: каждый опрос раздела базу не спрашивает", async () => {
    const { readOnlineVisitors } = await import("./online");
    rpc.mockResolvedValue({ data: 12, error: null });
    expect(await readOnlineVisitors(1_000)).toBe(12);
    rpc.mockResolvedValue({ data: 70, error: null });
    expect(await readOnlineVisitors(20_000)).toBe(12);
    expect(await readOnlineVisitors(31_001)).toBe(70);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("одновременные запросы ждут один ответ базы", async () => {
    const { readOnlineVisitors } = await import("./online");
    rpc.mockResolvedValue({ data: 5, error: null });
    expect(await Promise.all([readOnlineVisitors(1_000), readOnlineVisitors(1_001)])).toEqual([5, 5]);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("база не ответила — null (средняя частота), без исключения", async () => {
    const { readOnlineVisitors } = await import("./online");
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: null, error: { message: "timeout" } });
    expect(await readOnlineVisitors(1_000)).toBeNull();
  });
});
