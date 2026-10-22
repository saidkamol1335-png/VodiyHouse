import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createStaffMember, type CreateStaffDeps } from "./createStaff";

const INPUT = { fullName: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", role: "manager" as const };
const PASSWORD = "Ab3cdEfgh7Jk";

function deps(patch: Partial<CreateStaffDeps> = {}) {
  return {
    generatePassword: vi.fn(() => PASSWORD),
    createAuthUser: vi.fn<CreateStaffDeps["createAuthUser"]>(async () => ({ id: "user-9" })),
    insertProfile: vi.fn<CreateStaffDeps["insertProfile"]>(async () => null),
    deleteAuthUser: vi.fn<CreateStaffDeps["deleteAuthUser"]>(async () => true),
    ...patch,
  };
}

describe("добавить сотрудника", () => {
  it("успех: пользователь Auth с паролем, потом профиль; в ответе — только id, имя, email, роль и пароль", async () => {
    const fake = deps();
    const outcome = await createStaffMember(fake, INPUT);
    expect(outcome).toEqual({
      kind: "created",
      member: { id: "user-9", fullName: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", role: "manager" },
      password: PASSWORD,
    });
    expect(fake.createAuthUser).toHaveBeenCalledWith({ email: INPUT.email, password: PASSWORD });
    expect(fake.insertProfile).toHaveBeenCalledWith({ id: "user-9", fullName: INPUT.fullName, role: "manager" });
    expect(fake.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("email занят → emailTaken, профиль не вставляется", async () => {
    const fake = deps({ createAuthUser: async () => ({ error: new AuthApiError("x", 422, "email_exists") }) });
    expect(await createStaffMember(fake, INPUT)).toEqual({ kind: "error", code: "emailTaken" });
    expect(fake.insertProfile).not.toHaveBeenCalled();
  });

  it("профиль не вставился → пользователь Auth удаляется; отказ прав — forbidden, прочее — createFailed", async () => {
    const forbidden = deps({ insertProfile: async () => ({ code: "42501", hint: null }) });
    expect(await createStaffMember(forbidden, INPUT)).toEqual({ kind: "error", code: "forbidden" });
    expect(forbidden.deleteAuthUser).toHaveBeenCalledWith("user-9");

    const broken = deps({ insertProfile: async () => ({ code: "XX000" }), deleteAuthUser: async () => false });
    expect(await createStaffMember(broken, INPUT)).toEqual({ kind: "error", code: "createFailed" });
  });

  it("пароль не попадает в console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    await createStaffMember(deps(), INPUT);
    await createStaffMember(deps({ insertProfile: async () => ({ code: "XX000" }) }), INPUT);
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(PASSWORD);
    }
    vi.restoreAllMocks();
  });
});
