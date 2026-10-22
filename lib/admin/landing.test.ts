import { describe, expect, it } from "vitest";
import type { CabinetViewer } from "./access";
import { afterSignInPath, DISABLED_LOGIN_PATH, passwordPageTarget } from "./landing";

const viewer = (patch: Partial<CabinetViewer> = {}): CabinetViewer => ({
  id: "id",
  role: "head",
  name: "Бахтиёр Каримов",
  mustChangePassword: false,
  ...patch,
});

describe("куда вести после входа", () => {
  it("смена пароля важнее раздела роли", () => {
    expect(afterSignInPath(viewer({ mustChangePassword: true }))).toBe("/admin/parol");
    expect(afterSignInPath(viewer({ role: "videographer", mustChangePassword: true }))).toBe(
      "/admin/parol",
    );
  });

  it("без смены пароля — первый раздел роли (сейчас Главная у всех)", () => {
    expect(afterSignInPath(viewer())).toBe("/admin");
    expect(afterSignInPath(viewer({ role: "videographer" }))).toBe("/admin");
  });
});

describe("/admin/parol", () => {
  it("без входа → вход; отключён → вход с уведомлением; пароль уже свой → раздел; нужна смена → форма", () => {
    expect(passwordPageTarget({ kind: "login" })).toBe("/admin/vhod");
    expect(passwordPageTarget({ kind: "noAccess" })).toBe(DISABLED_LOGIN_PATH);
    expect(DISABLED_LOGIN_PATH).toBe("/admin/vhod?prichina=otklyuchen");
    expect(passwordPageTarget({ kind: "ok", viewer: viewer() })).toBe("/admin");
    expect(
      passwordPageTarget({ kind: "changePassword", viewer: viewer({ mustChangePassword: true }) }),
    ).toBeNull();
  });
});
