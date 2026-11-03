import { describe, expect, it, vi } from "vitest";
import type { CabinetViewer } from "./access";
import { decideActionGuard } from "./session";

// session.ts — серверный модуль (next/headers, Supabase): здесь — только чистое решение.
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

const viewer = (patch: Partial<CabinetViewer> = {}): CabinetViewer => ({
  id: "id",
  role: "manager",
  name: "Дилноза Юсупова",
  mustChangePassword: false,
  ...patch,
});

describe("кого пускать в Server Action", () => {
  it("нет сессии → session; нет доступа → forbidden", () => {
    expect(decideActionGuard({ kind: "login" }, ["head"], { allowPasswordChange: false })).toEqual({ code: "session" });
    expect(decideActionGuard({ kind: "noAccess" }, ["head"], { allowPasswordChange: false })).toEqual({ code: "forbidden" });
  });

  it("ждёт смены пароля: в обычные действия — нет, в смену пароля — да", () => {
    const pending = { kind: "changePassword" as const, viewer: viewer({ mustChangePassword: true }) };
    expect(decideActionGuard(pending, ["manager"], { allowPasswordChange: false })).toEqual({ code: "forbidden" });
    expect(decideActionGuard(pending, ["manager"], { allowPasswordChange: true })).toEqual({ viewer: pending.viewer });
  });

  it("руководитель без второго фактора: только действия экрана кода (п. 8)", () => {
    const factor = { kind: "secondFactor" as const, viewer: viewer({ role: "head" }) };
    expect(decideActionGuard(factor, ["head"], { allowPasswordChange: false })).toEqual({ code: "forbidden" });
    expect(decideActionGuard(factor, ["head"], { allowPasswordChange: false, allowSecondFactor: true })).toEqual({
      viewer: factor.viewer,
    });
  });

  it("роль не из списка действия → forbidden; из списка → сотрудник", () => {
    const ok = { kind: "ok" as const, viewer: viewer() };
    expect(decideActionGuard(ok, ["head"], { allowPasswordChange: false })).toEqual({ code: "forbidden" });
    expect(decideActionGuard(ok, ["head", "manager"], { allowPasswordChange: false })).toEqual({ viewer: ok.viewer });
  });
});
