import { describe, expect, it } from "vitest";
import {
  cabinetOpenWithoutLogin,
  DEV_VIEWER,
  headFactorFresh,
  isStaffRole,
  resolveViewer,
  type OwnProfileRow,
} from "./access";

const ID = "6f1c2c1e-6b1f-4bb0-9d7e-0d2b9f1d1a01";
const profile = (patch: Partial<OwnProfileRow> = {}): OwnProfileRow => ({
  id: ID,
  full_name: "Дилноза Юсупова",
  role: "manager",
  is_active: true,
  must_change_password: false,
  ...patch,
});

describe("кабинет без входа", () => {
  it("только вне продакшена и только без ключей Supabase", () => {
    expect(cabinetOpenWithoutLogin({ nodeEnv: "development", hasEnv: false })).toBe(true);
    expect(cabinetOpenWithoutLogin({ nodeEnv: "test", hasEnv: false })).toBe(true);
    expect(cabinetOpenWithoutLogin({ nodeEnv: "development", hasEnv: true })).toBe(false);
    expect(cabinetOpenWithoutLogin({ nodeEnv: "production", hasEnv: false })).toBe(false);
    expect(cabinetOpenWithoutLogin({ nodeEnv: "production", hasEnv: true })).toBe(false);
  });

  it("без входа кабинет видит руководитель без имени — меню целиком", () => {
    expect(DEV_VIEWER).toMatchObject({ role: "head", name: null, mustChangePassword: false });
  });
});

describe("роли", () => {
  it("три роли базы — да; HEAD, admin, пусто и не строка — нет", () => {
    for (const role of ["head", "manager", "mobilographer"]) expect(isStaffRole(role)).toBe(true);
    for (const value of ["HEAD", "admin", "", null, 1]) expect(isStaffRole(value)).toBe(false);
  });
});

describe("resolveViewer", () => {
  it("нет сессии → вход", () => {
    expect(resolveViewer(null, null)).toEqual({ kind: "login" });
  });

  it("нет профиля, чужой профиль, отключён, роль вне enum → нет доступа", () => {
    expect(resolveViewer(ID, null)).toEqual({ kind: "noAccess" });
    expect(resolveViewer(ID, profile({ id: "другой" }))).toEqual({ kind: "noAccess" });
    expect(resolveViewer(ID, profile({ is_active: false }))).toEqual({ kind: "noAccess" });
    expect(resolveViewer(ID, profile({ role: "admin" }))).toEqual({ kind: "noAccess" });
  });

  it("нужна смена пароля → changePassword с сотрудником", () => {
    expect(resolveViewer(ID, profile({ must_change_password: true }))).toEqual({
      kind: "changePassword",
      viewer: { id: ID, role: "manager", name: "Дилноза Юсупова", mustChangePassword: true },
    });
  });

  it("активный → ok: id, роль и имя — из профиля", () => {
    expect(resolveViewer(ID, profile({ role: "mobilographer" }))).toEqual({
      kind: "ok",
      viewer: { id: ID, role: "mobilographer", name: "Дилноза Юсупова", mustChangePassword: false },
    });
  });
});

describe("второй фактор руководителя (PLAN §10, п. 8)", () => {
  const NOW = Date.UTC(2026, 10, 3);
  const at = (days: number) => NOW / 1000 - days * 86_400;
  const staff = (role: string) => ({ id: "u", full_name: "Имя", role, is_active: true, must_change_password: false });

  it("свежий — aal2 и TOTP не старше 30 дней", () => {
    expect(headFactorFresh({ aal: "aal2", amr: [{ method: "totp", timestamp: at(1) }] }, NOW)).toBe(true);
    expect(headFactorFresh({ aal: "aal2", amr: [{ method: "totp", timestamp: at(31) }] }, NOW)).toBe(false);
    expect(headFactorFresh({ aal: "aal1", amr: [{ method: "password", timestamp: at(0) }] }, NOW)).toBe(false);
    expect(headFactorFresh({ aal: "aal2", amr: [{ method: "password", timestamp: at(0) }] }, NOW)).toBe(false);
    expect(headFactorFresh(null, NOW)).toBe(false);
  });

  it("без фактора руководитель идёт на код, менеджер — нет", () => {
    expect(resolveViewer("u", staff("head"), false).kind).toBe("secondFactor");
    expect(resolveViewer("u", staff("head"), true).kind).toBe("ok");
    expect(resolveViewer("u", staff("manager"), false).kind).toBe("ok");
    expect(resolveViewer("u", { ...staff("head"), must_change_password: true }, false).kind).toBe("changePassword");
  });
});
