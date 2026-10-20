import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkNewPassword, generatePassword, PASSWORD_ALPHABET, PASSWORD_RULES, type RandomFill } from "./password";

/** Подставной источник: отдаёт заданные байты по кругу. */
const cycling = (values: number[]): RandomFill => {
  let index = 0;
  return (bytes) => bytes.map(() => values[index++ % values.length]!);
};

describe("временный пароль", () => {
  it("12 символов только из алфавита — нет 0 O o 1 l I i L", () => {
    for (let i = 0; i < 200; i += 1) {
      const password = generatePassword();
      expect(password).toHaveLength(12);
      expect([...password].every((char) => PASSWORD_ALPHABET.includes(char))).toBe(true);
    }
    expect(PASSWORD_ALPHABET).toHaveLength(54);
    expect(PASSWORD_ALPHABET).not.toMatch(/[0Oo1lIiL]/);
  });

  it("в каждом есть строчная, заглавная и цифра", () => {
    for (let i = 0; i < 500; i += 1) {
      const password = generatePassword();
      expect(password).toMatch(/[a-z]/);
      expect(password).toMatch(/[A-Z]/);
      expect(password).toMatch(/\d/);
    }
  });

  it("без перекоса: на 10 000 паролей каждый символ встречается в пределах ±25 % от средней", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 10_000; i += 1) {
      for (const char of generatePassword()) counts.set(char, (counts.get(char) ?? 0) + 1);
    }
    const average = (10_000 * 12) / PASSWORD_ALPHABET.length;
    for (const char of PASSWORD_ALPHABET) {
      expect(Math.abs((counts.get(char) ?? 0) - average) / average).toBeLessThan(0.25);
    }
  });

  it("байты от 216 отбрасываются, остальные берутся по модулю 54 (подставной источник)", () => {
    // 250 и 216 отбрасываются; 0 → A, 23 → a, 46 → 2, 54 → A — за круг «Aa2A».
    const password = generatePassword(cycling([250, 0, 216, 23, 46, 54]));
    expect(password).toBe("Aa2AAa2AAa2A");
  });

  it("детерминирован при подставном источнике; 1000 настоящих — все разные", () => {
    const fill = () => cycling([5, 30, 47, 12]);
    expect(generatePassword(fill())).toBe(generatePassword(fill()));
    expect(new Set(Array.from({ length: 1000 }, () => generatePassword())).size).toBe(1000);
  });

  it("источник без цифр — понятная ошибка, а не бесконечный цикл", () => {
    expect(() => generatePassword(cycling([0, 23]))).toThrow(/видами символов/);
  });
});

describe("свой пароль", () => {
  const valid = { current: "Temp7Pass9Xy", password: "мой-пароль-2026", confirm: "мой-пароль-2026" };

  it("сгенерированный проходит проверку как новый", () => {
    const password = generatePassword();
    expect(checkNewPassword({ current: "временный", password, confirm: password })).toEqual({});
  });

  it("9 символов — коротко, 10 — подходит", () => {
    expect(checkNewPassword({ ...valid, password: "123456789", confirm: "123456789" })).toEqual({ password: "tooShort" });
    expect(checkNewPassword({ ...valid, password: "1234567890", confirm: "1234567890" })).toEqual({});
  });

  it("больше 72 байт — слишком длинный (37 кириллических букв = 74 байта)", () => {
    const long = "я".repeat(37);
    expect(checkNewPassword({ ...valid, password: long, confirm: long })).toEqual({ password: "tooLong" });
  });

  it("повтор не совпадает; совпадает с временным; временный не введён", () => {
    expect(checkNewPassword({ ...valid, confirm: "другой-пароль" })).toEqual({ confirm: "mismatch" });
    expect(checkNewPassword({ ...valid, password: valid.current, confirm: valid.current })).toEqual({
      password: "sameAsCurrent",
    });
    expect(checkNewPassword({ ...valid, current: "" })).toEqual({ current: "currentRequired" });
  });

  it("пробелы не обрезаются — это часть пароля", () => {
    expect(checkNewPassword({ ...valid, password: " 123456789", confirm: "123456789 " })).toEqual({ confirm: "mismatch" });
  });

  it("минимальная длина совпадает с minimum_password_length в supabase/config.toml", () => {
    const config = readFileSync("supabase/config.toml", "utf8");
    expect(Number(config.match(/^minimum_password_length = (\d+)/m)?.[1])).toBe(PASSWORD_RULES.minLength);
  });
});
