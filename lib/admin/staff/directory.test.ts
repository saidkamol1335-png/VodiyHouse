import { describe, expect, it } from "vitest";
import { parseDirectoryRows, staffState, type DirectoryRow } from "./directory";
import { loginUrlOf } from "./invite";

const row = (patch: Partial<DirectoryRow> = {}): DirectoryRow => ({
  id: "id-1",
  full_name: "Дилноза Юсупова",
  role: "manager",
  is_active: true,
  must_change_password: false,
  email: "dilnoza@vodiyhouse.uz",
  last_sign_in_at: "2026-10-19T04:30:00+00:00",
  banned: false,
  created_at: "2026-10-01T06:00:00+00:00",
  ...patch,
});

describe("список сотрудников", () => {
  it("строки staff_directory → сотрудники; неизвестная роль отбрасывается", () => {
    expect(parseDirectoryRows([row(), row({ id: "id-2", role: "admin" })])).toEqual([
      {
        id: "id-1",
        fullName: "Дилноза Юсупова",
        role: "manager",
        isActive: true,
        mustChangePassword: false,
        email: "dilnoza@vodiyhouse.uz",
        lastSignInAt: "2026-10-19T04:30:00+00:00",
        banned: false,
        createdAt: "2026-10-01T06:00:00+00:00",
      },
    ]);
  });

  it("состояние: активен, ждёт первого входа, отключён и расхождения базы с Auth", () => {
    expect(staffState({ isActive: true, banned: false, mustChangePassword: false })).toBe("active");
    expect(staffState({ isActive: true, banned: false, mustChangePassword: true })).toBe("pending");
    expect(staffState({ isActive: false, banned: true, mustChangePassword: false })).toBe(
      "inactive",
    );
    expect(staffState({ isActive: false, banned: false, mustChangePassword: false })).toBe(
      "inactiveNotBanned",
    );
    expect(staffState({ isActive: true, banned: true, mustChangePassword: true })).toBe(
      "activeBanned",
    );
  });

  it("адрес входа для сообщения: тот же сайт + /admin/vhod", () => {
    expect(loginUrlOf("https://vodiyhouse.uz")).toBe("https://vodiyhouse.uz/admin/vhod");
    expect(loginUrlOf("http://localhost:3000/")).toBe("http://localhost:3000/admin/vhod");
  });
});
