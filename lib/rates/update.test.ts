import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { updateCbuRate } from "./update";

// Курс ЦБ по расписанию: что уходит в базу и что будет при сбое ЦБ или базы.

const cbu = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

const admin = (result: { data: unknown; error: unknown }) => {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
};

const USD = [{ Ccy: "USD", Rate: "12045.67", Nominal: "1", Date: "28.10.2026" }];

describe("курс ЦБ по расписанию", () => {
  it("курс и дата ЦБ уходят в set_cbu_exchange_rate; ответ базы — изменился ли курс", async () => {
    const db = admin({ data: true, error: null });
    await expect(updateCbuRate(db.client, cbu(USD))).resolves.toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("set_cbu_exchange_rate", { p_rate: 12045.67, p_date: "2026-10-28" });
  });

  it("тот же курс — не изменился", async () => {
    await expect(updateCbuRate(admin({ data: false, error: null }).client, cbu(USD))).resolves.toBe(false);
  });

  it("ЦБ не ответил или прислал чужое — в базу ничего не пишем", async () => {
    const db = admin({ data: true, error: null });
    await expect(updateCbuRate(db.client, cbu({}, 503))).rejects.toThrow("ЦБ ответил 503");
    await expect(updateCbuRate(db.client, cbu([{ Ccy: "EUR" }]))).rejects.toThrow();
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it("база отказала — ошибка, а не «не изменился»", async () => {
    const db = admin({ data: null, error: { message: "Неверная дата курса" } });
    await expect(updateCbuRate(db.client, cbu(USD))).rejects.toThrow("rate-update-failed");
  });
});
