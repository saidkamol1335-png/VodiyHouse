// Проверка облака одной командой (`npm run cloud:check`): ключи в .env.local, настройки Auth,
// миграции, DEMO и первый руководитель. Значения ключей не печатаются — только «есть / нет / не тот».
// Без импортов: файл подключает scripts/cloud-check.mjs (Node 24 читает .ts сам).

export type CheckStatus = "ok" | "fail" | "manual";
export type CheckLine = { status: CheckStatus; text: string; hint?: string };
export type EnvValues = Record<string, string | undefined>;

const PROJECT_URL = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/;
const MIN_PASSWORD_LENGTH = 10;
const KEYS_PAGE = "Project Settings → API Keys";

const ok = (text: string): CheckLine => ({ status: "ok", text });
const fail = (text: string, hint?: string): CheckLine => ({ status: "fail", text, hint });
const manual = (text: string, hint?: string): CheckLine => ({ status: "manual", text, hint });

export function projectRefFromUrl(url: string | undefined): string | null {
  return PROJECT_URL.exec(url?.trim() ?? "")?.[1] ?? null;
}

function checkUrl(env: EnvValues): CheckLine {
  if (!env.NEXT_PUBLIC_SUPABASE_URL)
    return fail(
      "NEXT_PUBLIC_SUPABASE_URL — пусто",
      "кнопка Connect → адрес проекта https://<ref>.supabase.co",
    );
  if (!projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL))
    return fail("NEXT_PUBLIC_SUPABASE_URL — не вида https://<ref>.supabase.co");
  return ok("NEXT_PUBLIC_SUPABASE_URL");
}

function checkKeys(env: EnvValues): CheckLine[] {
  const publishable = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY;
  const lines: CheckLine[] = [
    publishable
      ? ok("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
      : fail("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — пусто", `${KEYS_PAGE} → Publishable key`),
  ];
  if (!secret) lines.push(fail("SUPABASE_SECRET_KEY — пусто", `${KEYS_PAGE} → Secret keys`));
  else if (secret === publishable)
    lines.push(fail("SUPABASE_SECRET_KEY совпадает с публичным ключом"));
  else if (!secret.startsWith("sb_secret_")) {
    lines.push(
      fail(
        "SUPABASE_SECRET_KEY — старый service_role",
        "нужен новый sb_secret_…: со старым Auth не принимает IP посетителя",
      ),
    );
  } else lines.push(ok("SUPABASE_SECRET_KEY (sb_secret_…)"));
  const leaked = Object.entries(env).find(
    ([name, value]) => name.startsWith("NEXT_PUBLIC_") && value?.startsWith("sb_secret_"),
  );
  if (leaked)
    lines.push(fail(`${leaked[0]} — секретный ключ с префиксом NEXT_PUBLIC_ уйдёт в браузер`));
  return lines;
}

function checkDbUrl(value: string | undefined, ref: string | null): CheckLine {
  if (!value) return fail("SUPABASE_DB_URL — пусто", "Connect → Session pooler");
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail("SUPABASE_DB_URL — не строка подключения postgresql://…");
  }
  if (parsed.port === "6543")
    return fail("SUPABASE_DB_URL — Transaction pooler", "нужен Session pooler (порт 5432)");
  if (ref && !`${decodeURIComponent(parsed.username)}@${parsed.hostname}`.includes(ref)) {
    return fail("SUPABASE_DB_URL — от другого проекта (ref не совпадает с адресом)");
  }
  return ok("SUPABASE_DB_URL");
}

function checkE2eRef(value: string | undefined, ref: string | null): CheckLine {
  if (!value)
    return fail(
      "E2E_SUPABASE_PROJECT_REF — пусто",
      ref ? `ref проекта: ${ref}` : "часть адреса до .supabase.co",
    );
  if (ref && value.trim() !== ref)
    return fail("E2E_SUPABASE_PROJECT_REF не совпадает с адресом проекта");
  return ok("E2E_SUPABASE_PROJECT_REF");
}

/** Ключи в .env.local. */
export function checkEnv(env: EnvValues): CheckLine[] {
  const ref = projectRefFromUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  return [
    checkUrl(env),
    ...checkKeys(env),
    checkDbUrl(env.SUPABASE_DB_URL, ref),
    checkE2eRef(env.E2E_SUPABASE_PROJECT_REF, ref),
  ];
}

type Flag = { value: unknown; want: boolean; okText: string; failText: string; hint: string };

function flagLine({ value, want, okText, failText, hint }: Flag): CheckLine {
  if (typeof value !== "boolean") return manual(`${okText}?`, hint);
  return value === want ? ok(okText) : fail(failText, hint);
}

const PROVIDERS = "Authentication → Sign In / Providers";

/** Открытые настройки Auth: GET /auth/v1/settings. Чего нет в ответе — «проверь вручную». */
export function checkAuthSettings(settings: unknown): CheckLine[] {
  const s = (settings ?? {}) as {
    external?: Record<string, unknown>;
    disable_signup?: unknown;
    mailer_autoconfirm?: unknown;
  };
  return [
    flagLine({
      value: s.external?.email,
      want: true,
      okText: "вход по email включён",
      failText: "вход по email выключен",
      hint: `${PROVIDERS} → Email`,
    }),
    flagLine({
      value: s.disable_signup,
      want: true,
      okText: "регистрация закрыта",
      failText: "регистрация открыта",
      hint: `${PROVIDERS} → Allow new users to sign up — выключить`,
    }),
    flagLine({
      value: s.external?.anonymous_users,
      want: false,
      okText: "анонимный вход выключен",
      failText: "анонимный вход включён",
      hint: `${PROVIDERS} → Anonymous sign-ins — выключить`,
    }),
    flagLine({
      value: s.mailer_autoconfirm,
      want: true,
      okText: "Confirm email выключен",
      failText: "Confirm email включён",
      hint: `${PROVIDERS} → Email → Confirm email — выключить`,
    }),
  ];
}

const ASYMMETRIC_KEY_TYPES = new Set(["EC", "RSA", "OKP"]);

/** JWKS проекта: есть асимметричный ключ — подпись сессии проверяется без запроса к Auth. */
export function checkJwks(jwks: unknown): CheckLine {
  const keys = (jwks as { keys?: { kty?: string; alg?: string }[] } | null)?.keys ?? [];
  const asymmetric = keys.find((key) => ASYMMETRIC_KEY_TYPES.has(key.kty ?? ""));
  if (asymmetric) return ok(`асимметричные JWT-ключи (${asymmetric.alg ?? asymmetric.kty})`);
  return fail(
    "JWT-ключи симметричные",
    "Project Settings → JWT Keys → перейти на асимметричные: иначе каждый переход по кабинету — запрос к Auth (лимит 30 за 5 мин)",
  );
}

const RATE_LIMITS = "Authentication → Rate Limits → IP Address Forwarding";
const PASSWORDS = "Authentication → Passwords";

/** Закрытые настройки — Management API (GET /v1/projects/{ref}/config/auth), только с токеном. */
export function checkAuthConfig(config: unknown): CheckLine[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const minLength = c.password_min_length;
  return [
    typeof minLength !== "number"
      ? manual("минимальная длина пароля?", `${PASSWORDS} → ${MIN_PASSWORD_LENGTH}`)
      : minLength >= MIN_PASSWORD_LENGTH
        ? ok(`минимальная длина пароля ${minLength}`)
        : fail(`минимальная длина пароля ${minLength}`, `${PASSWORDS} → ${MIN_PASSWORD_LENGTH}`),
    flagLine({
      value: c.security_update_password_require_reauthentication,
      want: false,
      okText: "Secure password change выключен",
      failText: "Secure password change включён",
      hint: `${PASSWORDS} → Secure password change — выключить`,
    }),
    flagLine({
      value: c.security_sb_forwarded_for_enabled,
      want: true,
      okText: "пересылка IP посетителя включена",
      failText: "пересылка IP посетителя выключена",
      hint: `${RATE_LIMITS} — включить`,
    }),
  ];
}

/** Без токена Management API эти настройки снаружи не видны. */
export function manualAuthConfig(): CheckLine[] {
  return [
    manual(`минимальная длина пароля — ${MIN_PASSWORD_LENGTH}`, PASSWORDS),
    manual("Secure password change — выключен", PASSWORDS),
    manual("пересылка IP посетителя — включена", RATE_LIMITS),
  ];
}

export type DatabaseState = {
  applied: string[];
  local: string[];
  /** Применённые миграции, чей файл изменили потом (lib/supabase/migrationDrift.ts). */
  edited: string[];
  demoComplexes: number | null;
  activeHeads: number | null;
};

/** Что уже сделано в базе: миграции → DEMO → первый руководитель. null — таблиц ещё нет. */
export function checkDatabase(state: DatabaseState): CheckLine[] {
  const missing = state.local.filter((version) => !state.applied.includes(version));
  const lines = [
    missing.length === 0
      ? ok(`миграции: все ${state.local.length}`)
      : fail(
          `миграции: в облаке ${state.local.length - missing.length} из ${state.local.length}`,
          "npm run db:push",
        ),
  ];
  if (state.edited.length > 0)
    lines.push(
      fail(
        `миграции изменены после применения: ${state.edited.join(", ")}`,
        "применённую не правим — исправление новым файлом миграции",
      ),
    );
  if (state.demoComplexes === null || state.activeHeads === null) return lines;
  lines.push(
    state.demoComplexes > 0
      ? ok(`DEMO: ЖК ${state.demoComplexes}`)
      : fail("DEMO нет", "npm run demo:seed"),
  );
  lines.push(
    state.activeHeads > 0
      ? ok(`активных руководителей: ${state.activeHeads}`)
      : fail("руководителя нет", 'npm run staff:create-head -- --email … --name "…"'),
  );
  return lines;
}
