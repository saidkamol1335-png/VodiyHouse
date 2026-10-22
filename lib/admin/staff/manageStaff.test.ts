import { describe, expect, it, vi } from "vitest";
import { resetStaffPassword, setStaffActive, type ManageStaffDeps } from "./manageStaff";

const HEAD = "head-1";
const STAFF = "staff-2";

function deps(patch: Partial<ManageStaffDeps> = {}) {
  const calls: string[] = [];
  const fake = {
    updateActive: vi.fn<ManageStaffDeps["updateActive"]>(
      async (_id, active) => (calls.push(`db:${active}`), { rows: 1 }),
    ),
    setBan: vi.fn<ManageStaffDeps["setBan"]>(
      async (_id, banned) => (calls.push(`ban:${banned}`), true),
    ),
    requirePasswordChange: vi.fn<ManageStaffDeps["requirePasswordChange"]>(
      async () => (calls.push("rpc"), null),
    ),
    setPassword: vi.fn<ManageStaffDeps["setPassword"]>(async () => (calls.push("password"), true)),
    generatePassword: vi.fn(() => "Ab3cdEfgh7Jk"),
    ...patch,
  };
  return { fake, calls };
}

describe("отключить и включить", () => {
  it("отключение: сначала база, потом бан; включение: база, потом снятие бана", async () => {
    const off = deps();
    expect(
      await setStaffActive(off.fake, { actorId: HEAD, staffId: STAFF, active: false }),
    ).toEqual({ kind: "done" });
    expect(off.calls).toEqual(["db:false", "ban:true"]);
    const on = deps();
    expect(await setStaffActive(on.fake, { actorId: HEAD, staffId: STAFF, active: true })).toEqual({
      kind: "done",
    });
    expect(on.calls).toEqual(["db:true", "ban:false"]);
  });

  it("себя → self без вызовов", async () => {
    const { fake, calls } = deps();
    expect(await setStaffActive(fake, { actorId: HEAD, staffId: HEAD, active: false })).toEqual({
      kind: "error",
      code: "self",
    });
    expect(calls).toEqual([]);
  });

  it("0 строк → notFound; последний руководитель → lastHead; бан не вызывается", async () => {
    const missing = deps({ updateActive: async () => ({ rows: 0 }) });
    expect(
      await setStaffActive(missing.fake, { actorId: HEAD, staffId: STAFF, active: false }),
    ).toEqual({
      kind: "error",
      code: "notFound",
    });
    const lastHead = deps({
      updateActive: async () => ({ error: { code: "23514", hint: "vh:last_head" } }),
    });
    expect(
      await setStaffActive(lastHead.fake, { actorId: HEAD, staffId: STAFF, active: false }),
    ).toEqual({
      kind: "error",
      code: "lastHead",
    });
    expect(missing.fake.setBan).not.toHaveBeenCalled();
    expect(lastHead.fake.setBan).not.toHaveBeenCalled();
  });

  it("бан не прошёл → banFailed; снятие не прошло → unbanFailed", async () => {
    const { fake } = deps({ setBan: async () => false });
    expect(await setStaffActive(fake, { actorId: HEAD, staffId: STAFF, active: false })).toEqual({
      kind: "error",
      code: "banFailed",
    });
    expect(await setStaffActive(fake, { actorId: HEAD, staffId: STAFF, active: true })).toEqual({
      kind: "error",
      code: "unbanFailed",
    });
  });
});

describe("«Новый пароль»", () => {
  it("сначала база (права, журнал), потом пароль в Auth; пароль — в ответе", async () => {
    const { fake, calls } = deps();
    expect(await resetStaffPassword(fake, { actorId: HEAD, staffId: STAFF })).toEqual({
      kind: "reset",
      password: "Ab3cdEfgh7Jk",
    });
    expect(calls).toEqual(["rpc", "password"]);
    expect(fake.setPassword).toHaveBeenCalledWith(STAFF, "Ab3cdEfgh7Jk");
  });

  it("база отказала → её код, пароль в Auth не меняется", async () => {
    const { fake } = deps({
      requirePasswordChange: async () => ({ code: "42501", hint: "vh:forbidden" }),
    });
    expect(await resetStaffPassword(fake, { actorId: HEAD, staffId: STAFF })).toEqual({
      kind: "error",
      code: "forbidden",
    });
    expect(fake.setPassword).not.toHaveBeenCalled();
  });

  it("себе → self; Auth не сменил → resetFailed", async () => {
    expect(await resetStaffPassword(deps().fake, { actorId: HEAD, staffId: HEAD })).toEqual({
      kind: "error",
      code: "self",
    });
    const { fake } = deps({ setPassword: async () => false });
    expect(await resetStaffPassword(fake, { actorId: HEAD, staffId: STAFF })).toEqual({
      kind: "error",
      code: "resetFailed",
    });
  });
});
