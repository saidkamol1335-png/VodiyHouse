import { describe, expect, it } from "vitest";
import { deviceOf, isBot } from "./visitor";

// Кого не считаем и какое устройство — по user-agent (шаг 3.12).

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const TAB = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";

describe("посетитель", () => {
  it("боты, превью ссылок, Lighthouse и безголовый браузер — не посетители", () => {
    for (const agent of ["Googlebot/2.1", "TelegramBot (like TwitterBot)", "facebookexternalhit/1.1", `${CHROME} HeadlessChrome`, "Chrome-Lighthouse", null]) {
      expect(isBot(agent)).toBe(true);
    }
    expect(isBot(CHROME)).toBe(false);
  });

  it("телефон, планшет, компьютер", () => {
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(TAB)).toBe("tablet");
    expect(deviceOf(CHROME)).toBe("desktop");
  });
});
