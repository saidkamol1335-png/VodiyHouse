// Пароли кабинета: генерация для нового сотрудника и проверка своего пароля.
// Без импортов: файл подключает и scripts/staff-create-head.mjs (Node 24 читает .ts сам).

export const PASSWORD_RULES = {
  /** Совпадает с minimum_password_length в supabase/config.toml (тест сверяет). */
  minLength: 10,
  /** bcrypt в Supabase Auth учитывает только первые 72 байта. */
  maxBytes: 72,
  generatedLength: 12,
} as const;

/** Без похожих символов (0 O o 1 l I i L): пароль перепечатывают из Telegram. 54 символа. */
export const PASSWORD_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export type RandomFill = (bytes: Uint8Array) => Uint8Array;

const cryptoFill: RandomFill = (bytes) => globalThis.crypto.getRandomValues(bytes);

// Байты от 216 отбрасываются: 216 = 54 × 4, иначе первые символы алфавита выпадали бы чаще.
const UNBIASED_LIMIT = 256 - (256 % PASSWORD_ALPHABET.length);
const MAX_ATTEMPTS = 100;

function randomChars(count: number, fill: RandomFill): string {
  let result = "";
  while (result.length < count) {
    for (const byte of fill(new Uint8Array(count * 2))) {
      if (byte < UNBIASED_LIMIT) result += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
      if (result.length === count) break;
    }
  }
  return result;
}

function hasEveryKind(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

/** Временный пароль: 12 символов (~69 бит), есть строчная, заглавная и цифра. */
export function generatePassword(fill: RandomFill = cryptoFill): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = randomChars(PASSWORD_RULES.generatedLength, fill);
    if (hasEveryKind(candidate)) return candidate;
  }
  throw new Error("Источник случайных байтов не даёт пароль со всеми видами символов");
}

// Проверка безопасности 29.10: одной длины мало — «1234567890» проходил даже у руководителя.
/** Слова, которые подбирают первыми (буквы пароля без цифр и знаков: «Password2026!» → «password»). */
const COMMON_WORDS = [
  "password", "parol", "qwerty", "qwertyuiop", "admin", "administrator", "vodiyhouse", "vodiy",
  "iloveyou", "letmein", "welcome", "пароль", "йцукен", "админ",
];
/**
 * Ряды клавиатуры с цифрами: пароль целиком из такого ряда («1q2w3e4r5t») — тоже первым в переборе.
 * Ряды без цифр («qwertyuiop», «1234567890») отсекает уже требование букв и цифр.
 */
const SEQUENCES = ["1q2w3e4r5t6y7u8i9o0p", "1qaz2wsx3edc4rfv5tgb6yhn7ujm8ik9ol0p", "1й2ц3у4к5е6н7г8ш9щ0з"];
const MIN_DISTINCT_CHARS = 5;

const reversed = (text: string) => [...text].reverse().join("");

/** Простой пароль: без букв или без цифр, меньше 5 разных символов, ряд клавиатуры или частое слово. */
export function isWeakPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return true;
  if (new Set(lower).size < MIN_DISTINCT_CHARS) return true;
  if (SEQUENCES.some((row) => row.includes(lower) || reversed(row).includes(lower))) return true;
  return COMMON_WORDS.includes(lower.replace(/[^\p{L}]/gu, ""));
}

export type PasswordField = "current" | "password" | "confirm";
export type PasswordIssueCode = "currentRequired" | "tooShort" | "tooLong" | "mismatch" | "sameAsCurrent" | "weakPassword";
export type PasswordIssues = Partial<Record<PasswordField, PasswordIssueCode>>;

/** Свой пароль на /admin/parol. Пробелы не обрезаются: это часть пароля. */
export function checkNewPassword(input: { current: string; password: string; confirm: string }): PasswordIssues {
  const issues: PasswordIssues = {};
  if (!input.current) issues.current = "currentRequired";
  if (input.password.length < PASSWORD_RULES.minLength) issues.password = "tooShort";
  else if (new TextEncoder().encode(input.password).length > PASSWORD_RULES.maxBytes) issues.password = "tooLong";
  else if (input.current && input.password === input.current) issues.password = "sameAsCurrent";
  else if (isWeakPassword(input.password)) issues.password = "weakPassword";
  if (!issues.password && input.confirm !== input.password) issues.confirm = "mismatch";
  return issues;
}
