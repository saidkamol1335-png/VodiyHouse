import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  changeFirstPassword,
  type ChangePasswordDeps,
  type ChangePasswordInput,
} from "./changePassword";

const INPUT: ChangePasswordInput = {
  userId: "user-1",
  email: "dilnoza@vodiyhouse.uz",
  role: "manager",
  current: "Temp7Pass9Xy",
  password: "мой-новый-пароль",
  confirm: "мой-новый-пароль",
};

function deps(patch: Partial<ChangePasswordDeps> = {}) {
  const calls: string[] = [];
  const fake = {
    verifyCurrentPassword: vi.fn<ChangePasswordDeps["verifyCurrentPassword"]>(
      async () => (calls.push("verify"), "ok"),
    ),
    updatePassword: vi.fn<ChangePasswordDeps["updatePassword"]>(
      async () => (calls.push("update"), null),
    ),
    clearMustChange: vi.fn<ChangePasswordDeps["clearMustChange"]>(
      async () => (calls.push("clear"), true),
    ),
    signOutOthers: vi.fn<ChangePasswordDeps["signOutOthers"]>(
      async () => void calls.push("others"),
    ),
    ...patch,
  };
  return { fake, calls };
}

describe("первая смена пароля", () => {
  it("порядок: временный → новый → флаг → остальные сессии → раздел роли", async () => {
    const { fake, calls } = deps();
    expect(await changeFirstPassword(fake, INPUT)).toEqual({ kind: "redirect", to: "/admin" });
    expect(calls).toEqual(["verify", "update", "clear", "others"]);
    expect(fake.verifyCurrentPassword).toHaveBeenCalledWith(INPUT.email, INPUT.current);
    expect(fake.updatePassword).toHaveBeenCalledWith(INPUT.password);
    expect(fake.clearMustChange).toHaveBeenCalledWith(INPUT.userId);
  });

  it("короткий и несовпадение — ошибки полей, Supabase не вызывается", async () => {
    const { fake } = deps();
    expect(
      await changeFirstPassword(fake, { ...INPUT, password: "коротко", confirm: "коротко" }),
    ).toEqual({
      kind: "error",
      code: null,
      fieldErrors: { password: "tooShort" },
    });
    expect(await changeFirstPassword(fake, { ...INPUT, confirm: "другой-пароль-1" })).toEqual({
      kind: "error",
      code: null,
      fieldErrors: { confirm: "mismatch" },
    });
    expect(fake.verifyCurrentPassword).not.toHaveBeenCalled();
    expect(fake.updatePassword).not.toHaveBeenCalled();
  });

  it("неверный временный → у поля «Временный пароль», новый не ставится", async () => {
    const { fake } = deps({ verifyCurrentPassword: async () => "wrong" });
    expect(await changeFirstPassword(fake, INPUT)).toEqual({
      kind: "error",
      code: null,
      fieldErrors: { current: "currentWrong" },
    });
    expect(fake.updatePassword).not.toHaveBeenCalled();
  });

  it("сеть при проверке временного → network, новый не ставится", async () => {
    const { fake } = deps({
      verifyCurrentPassword: async () => ({ error: new AuthRetryableFetchError("сбой", 503) }),
    });
    expect(await changeFirstPassword(fake, INPUT)).toMatchObject({
      kind: "error",
      code: "network",
    });
    expect(fake.updatePassword).not.toHaveBeenCalled();
  });

  it("сервер: тот же пароль и слабый — у поля; флаг не снимается", async () => {
    for (const [code, field] of [
      ["same_password", "sameAsCurrent"],
      ["weak_password", "weakPassword"],
    ] as const) {
      const { fake } = deps({ updatePassword: async () => new AuthApiError("x", 422, code) });
      expect(await changeFirstPassword(fake, INPUT)).toEqual({
        kind: "error",
        code: null,
        fieldErrors: { password: field },
      });
      expect(fake.clearMustChange).not.toHaveBeenCalled();
    }
  });

  it("флаг не снялся → finishFailed, остальные сессии не трогаем", async () => {
    const { fake } = deps({ clearMustChange: async () => false });
    expect(await changeFirstPassword(fake, INPUT)).toEqual({
      kind: "error",
      code: "finishFailed",
      fieldErrors: {},
    });
    expect(fake.signOutOthers).not.toHaveBeenCalled();
  });

  it("видеограф после смены — на Главную с заглушкой роли (пока нет раздела «Видео»)", async () => {
    const { fake } = deps();
    expect(await changeFirstPassword(fake, { ...INPUT, role: "videographer" })).toEqual({
      kind: "redirect",
      to: "/admin",
    });
  });
});
