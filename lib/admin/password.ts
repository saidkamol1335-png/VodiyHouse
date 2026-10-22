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

export type PasswordField = "current" | "password" | "confirm";
export type PasswordIssueCode =
  "currentRequired" | "tooShort" | "tooLong" | "mismatch" | "sameAsCurrent";
export type PasswordIssues = Partial<Record<PasswordField, PasswordIssueCode>>;

/** Свой пароль на /admin/parol. Пробелы не обрезаются: это часть пароля. */
export function checkNewPassword(input: {
  current: string;
  password: string;
  confirm: string;
}): PasswordIssues {
  const issues: PasswordIssues = {};
  if (!input.current) issues.current = "currentRequired";
  if (input.password.length < PASSWORD_RULES.minLength) issues.password = "tooShort";
  else if (new TextEncoder().encode(input.password).length > PASSWORD_RULES.maxBytes)
    issues.password = "tooLong";
  else if (input.current && input.password === input.current) issues.password = "sameAsCurrent";
  if (!issues.password && input.confirm !== input.password) issues.confirm = "mismatch";
  return issues;
}
