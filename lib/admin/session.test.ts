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
    expect(decideActionGuard({ kind: "login" }, ["head"], false)).toEqual({ code: "session" });
    expect(decideActionGuard({ kind: "noAccess" }, ["head"], false)).toEqual({ code: "forbidden" });
  });

  it("ждёт смены пароля: в обычные действия — нет, в смену пароля — да", () => {
    const pending = {
      kind: "changePassword" as const,
      viewer: viewer({ mustChangePassword: true }),
    };
    expect(decideActionGuard(pending, ["manager"], false)).toEqual({ code: "forbidden" });
    expect(decideActionGuard(pending, ["manager"], true)).toEqual({ viewer: pending.viewer });
  });

  it("роль не из списка действия → forbidden; из списка → сотрудник", () => {
    const ok = { kind: "ok" as const, viewer: viewer() };
    expect(decideActionGuard(ok, ["head"], false)).toEqual({ code: "forbidden" });
    expect(decideActionGuard(ok, ["head", "manager"], false)).toEqual({ viewer: ok.viewer });
  });
});
