import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegram, sendTelegramDocument, telegramMuted } from "./channels";

const config = { token: "t", chatId: "1", alertChatId: "2" };

describe("Telegram вне боевой сборки молчит (фаза F, п. 45)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("dev и тесты — заглушён; боевая сборка — нет; TELEGRAM_LIVE включает, TELEGRAM_DRY_RUN глушит всегда", () => {
    expect(telegramMuted({ NODE_ENV: "development" })).toBe(true);
    expect(telegramMuted({ NODE_ENV: "test" })).toBe(true);
    expect(telegramMuted({ NODE_ENV: "development", TELEGRAM_LIVE: "1" })).toBe(false);
    expect(telegramMuted({ NODE_ENV: "production" })).toBe(false);
    expect(telegramMuted({ NODE_ENV: "production", TELEGRAM_DRY_RUN: "1" })).toBe(true);
    expect(
      telegramMuted({ NODE_ENV: "development", TELEGRAM_LIVE: "1", TELEGRAM_DRY_RUN: "1" }),
    ).toBe(true);
  });

  it("заглушённые sendMessage и sendDocument не ходят в сеть и отвечают «не ушло»", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendTelegram(config, "2", "текст")).toEqual({ ok: false, error: "muted" });
    expect(await sendTelegramDocument(config, "2", { name: "a.csv", content: "x" }, "c")).toEqual({
      ok: false,
      error: "muted",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("боевая сборка — одно сообщение в sendMessage", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchSpy = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await sendTelegram(config, "2", "текст")).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]![0])).toMatch(/\/sendMessage$/);
  });
});
