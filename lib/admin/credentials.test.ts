import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isEmail,
  parsePasswordChange,
  parseSignIn,
  parseStaffInput,
  readStaffId,
  readText,
  STAFF_LIMITS,
} from "./credentials";

const form = (entries: [string, string | Blob][]) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe("readText", () => {
  it("файл, повтор ключа и нет поля → null", () => {
    expect(readText(form([["email", new Blob(["x"])]]), "email")).toBeNull();
    expect(readText(form([["email", "a"], ["email", "b"]]), "email")).toBeNull();
    expect(readText(form([]), "email")).toBeNull();
    expect(readText(form([["email", "a@b.uz"]]), "email")).toBe("a@b.uz");
  });
});

describe("вход", () => {
  it("email обрезается и в нижний регистр, пароль — как введён", () => {
    const parsed = parseSignIn(form([["email", "  Dilnoza@VodiyHouse.UZ "], ["password", " секрет "]]));
    expect(parsed).toEqual({ ok: true, value: { email: "dilnoza@vodiyhouse.uz", password: " секрет " } });
  });

  it("пусто и без @ → коды; email возвращается для поля", () => {
    expect(parseSignIn(form([["email", ""], ["password", ""]]))).toEqual({
      ok: false,
      email: "",
      fieldErrors: { email: "emailRequired", password: "passwordRequired" },
    });
    expect(parseSignIn(form([["email", "dilnoza"], ["password", "x"]]))).toEqual({
      ok: false,
      email: "dilnoza",
      fieldErrors: { email: "emailInvalid" },
    });
  });

  it("служебные поля Next.js ($ACTION_…) не мешают", () => {
    const parsed = parseSignIn(form([["$ACTION_ID_abc", ""], ["email", "a@b.uz"], ["password", "p"]]));
    expect(parsed.ok).toBe(true);
  });

  it("isEmail: до 254 символов, с @ и точкой в домене", () => {
    expect(isEmail("a@b.uz")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.uz")).toBe(false);
    expect(isEmail(`${"a".repeat(250)}@b.uz`)).toBe(false);
  });
});

describe("новый сотрудник", () => {
  const staff = (fullName: string, email = "aziz@vodiyhouse.uz", role = "manager") =>
    parseStaffInput(form([["fullName", fullName], ["email", email], ["role", role]]));

  it("имя: обрезка и сжатие пробелов; роль — одна из трёх", () => {
    expect(staff("  Азиз   Рахимов ")).toEqual({
      ok: true,
      value: { fullName: "Азиз Рахимов", email: "aziz@vodiyhouse.uz", role: "manager" },
    });
  });

  it("пустое имя, 81 символ, плохой email и чужая роль → коды по полям", () => {
    expect(staff("", "плохой", "admin")).toMatchObject({
      ok: false,
      fieldErrors: { fullName: "fullNameRequired", email: "emailInvalid", role: "roleInvalid" },
    });
    expect(staff("я".repeat(81))).toMatchObject({ ok: false, fieldErrors: { fullName: "fullNameTooLong" } });
    expect(staff("я".repeat(80)).ok).toBe(true);
  });

  it("при ошибке введённое возвращается, чтобы форма не очищалась", () => {
    expect(staff("Азиз", "", "videographer")).toMatchObject({
      ok: false,
      fields: { fullName: "Азиз", email: "", role: "videographer" },
    });
  });

  it("предел имени совпадает с check у profiles.full_name в миграции", () => {
    const sql = readFileSync("supabase/migrations/20261019160000_staff_dictionaries_audit.sql", "utf8");
    const max = sql.match(/full_name text not null check \(length\(btrim\(full_name\)\) between 1 and (\d+)\)/)?.[1];
    expect(Number(max)).toBe(STAFF_LIMITS.fullNameMax);
  });
});

describe("служебные поля", () => {
  it("readStaffId: только uuid", () => {
    const id = "6F1C2C1E-6B1F-4BB0-9D7E-0D2B9F1D1A01";
    expect(readStaffId(form([["id", id]]))).toBe(id.toLowerCase());
    expect(readStaffId(form([["id", "1 or 1=1"]]))).toBeNull();
    expect(readStaffId(form([]))).toBeNull();
  });

  it("смена пароля: поля как введены, без обрезки", () => {
    expect(parsePasswordChange(form([["current", " a"], ["password", "b "], ["confirm", "c"]]))).toEqual({
      current: " a",
      password: "b ",
      confirm: "c",
    });
  });
});
