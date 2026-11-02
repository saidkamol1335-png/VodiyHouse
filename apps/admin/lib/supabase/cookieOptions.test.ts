import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "./cookieOptions";

describe("cookie сессии кабинета", () => {
  it("в продакшене — Secure; в разработке и тестах на http://localhost — нет", () => {
    expect(sessionCookieOptions("production")).toEqual({ secure: true });
    expect(sessionCookieOptions("development")).toEqual({ secure: false });
    expect(sessionCookieOptions("test")).toEqual({ secure: false });
    expect(sessionCookieOptions(undefined)).toEqual({ secure: false });
  });
});
