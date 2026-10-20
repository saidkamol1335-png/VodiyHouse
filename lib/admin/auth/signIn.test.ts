import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OwnProfileRow } from "../access";
import { signIn, type SignInDeps } from "./signIn";

const USER = "6f1c2c1e-6b1f-4bb0-9d7e-0d2b9f1d1a01";
const INPUT = { email: "bakhtiyor@vodiyhouse.uz", password: "Секретный-пароль-1" };
const profile = (patch: Partial<OwnProfileRow> = {}): OwnProfileRow => ({
  id: USER,
  full_name: "Бахтиёр Каримов",
  role: "head",
  is_active: true,
  must_change_password: false,
  ...patch,
});

function deps(patch: Partial<SignInDeps> = {}) {
  return {
    signInWithPassword: vi.fn<SignInDeps["signInWithPassword"]>(async () => ({ userId: USER })),
    readOwnProfile: vi.fn<SignInDeps["readOwnProfile"]>(async () => profile()),
    signOutLocal: vi.fn<SignInDeps["signOutLocal"]>(async () => undefined),
    ...patch,
  };
}

describe("вход", () => {
  afterEach(() => vi.restoreAllMocks());

  it("руководитель → Главная; профиль читается по id из входа", async () => {
    const fake = deps();
    expect(await signIn(fake, INPUT)).toEqual({ kind: "redirect", to: "/admin" });
    expect(fake.signInWithPassword).toHaveBeenCalledWith(INPUT);
    expect(fake.readOwnProfile).toHaveBeenCalledWith(USER);
    expect(fake.signOutLocal).not.toHaveBeenCalled();
  });

  it("пароль от руководителя → сначала /admin/parol", async () => {
    const fake = deps({ readOwnProfile: async () => profile({ must_change_password: true }) });
    expect(await signIn(fake, INPUT)).toEqual({ kind: "redirect", to: "/admin/parol" });
  });

  it("неверный пароль → invalidCredentials, профиль не читается", async () => {
    const fake = deps({ signInWithPassword: async () => ({ error: new AuthApiError("x", 400, "invalid_credentials") }) });
    expect(await signIn(fake, INPUT)).toEqual({ kind: "error", code: "invalidCredentials" });
    expect(fake.readOwnProfile).not.toHaveBeenCalled();
  });

  it("нет профиля или отключён → сессия закрывается, noAccess", async () => {
    for (const read of [async () => null, async () => profile({ is_active: false })]) {
      const fake = deps({ readOwnProfile: read });
      expect(await signIn(fake, INPUT)).toEqual({ kind: "error", code: "noAccess" });
      expect(fake.signOutLocal).toHaveBeenCalledTimes(1);
    }
  });

  it("сбой чтения профиля → сессия закрывается, unknown", async () => {
    const fake = deps({
      readOwnProfile: async () => {
        throw new Error("сеть");
      },
    });
    expect(await signIn(fake, INPUT)).toEqual({ kind: "error", code: "unknown" });
    expect(fake.signOutLocal).toHaveBeenCalledTimes(1);
  });

  it("сеть Auth → network", async () => {
    const fake = deps({ signInWithPassword: async () => ({ error: new AuthRetryableFetchError("сбой", 503) }) });
    expect(await signIn(fake, INPUT)).toEqual({ kind: "error", code: "network" });
  });

  it("пароль не попадает в console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    await signIn(deps({ readOwnProfile: async () => null }), INPUT);
    await signIn(deps({ signInWithPassword: async () => ({ error: new AuthApiError("x", 400, "user_banned") }) }), INPUT);
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(INPUT.password);
    }
  });
});
