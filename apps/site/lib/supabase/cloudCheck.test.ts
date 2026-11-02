// @vitest-environment node
import { describe, expect, it } from "vitest";
import { PASSWORD_RULES } from "@/lib/admin/password";
import {
  checkAuthConfig,
  checkAuthSettings,
  checkDatabase,
  checkEnv,
  checkJwks,
  manualAuthConfig,
  projectRefFromUrl,
  type CheckLine,
} from "./cloudCheck";
import { checkProd } from "./prodCheck";

const REF = "abcdefghijklmnopqrst";
const GOOD_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
  SUPABASE_SECRET_KEY: "sb_secret_x",
  SUPABASE_DB_URL: `postgresql://postgres.${REF}:pass@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  E2E_SUPABASE_PROJECT_REF: REF,
};

const statuses = (lines: CheckLine[]) => lines.map((line) => line.status);
const failures = (lines: CheckLine[]) =>
  lines.filter((line) => line.status === "fail").map((line) => line.text);

describe("ключи .env.local", () => {
  it("всё заполнено правильно — всё ✓", () => {
    expect(projectRefFromUrl(GOOD_ENV.NEXT_PUBLIC_SUPABASE_URL)).toBe(REF);
    expect(statuses(checkEnv(GOOD_ENV)).every((status) => status === "ok")).toBe(true);
  });

  it("пустой .env.local — ✗ по каждому ключу", () => {
    const lines = checkEnv({});
    expect(failures(lines)).toHaveLength(5);
  });

  it("значения ключей в вывод не попадают", () => {
    const leaky = {
      ...GOOD_ENV,
      SUPABASE_SECRET_KEY: "eyJsecret-value",
      SUPABASE_DB_URL: "postgresql://u:topsecret@h:6543/p",
    };
    const text = JSON.stringify(checkEnv(leaky));
    expect(text).not.toContain("eyJsecret-value");
    expect(text).not.toContain("topsecret");
  });

  it("старый service_role, ключ с NEXT_PUBLIC_, Transaction pooler, чужой проект, чужой ref e2e — ✗", () => {
    expect(
      failures(checkEnv({ ...GOOD_ENV, SUPABASE_SECRET_KEY: "eyJhbGciOi.legacy" }))[0],
    ).toContain("старый service_role");
    expect(failures(checkEnv({ ...GOOD_ENV, NEXT_PUBLIC_LEAK: "sb_secret_x" }))[0]).toContain(
      "NEXT_PUBLIC_LEAK",
    );
    expect(
      failures(
        checkEnv({
          ...GOOD_ENV,
          SUPABASE_DB_URL: GOOD_ENV.SUPABASE_DB_URL.replace(":5432", ":6543"),
        }),
      )[0],
    ).toContain("Transaction pooler");
    expect(
      failures(
        checkEnv({
          ...GOOD_ENV,
          SUPABASE_DB_URL: "postgresql://postgres.other:p@db.pooler.supabase.com:5432/postgres",
        }),
      )[0],
    ).toContain("другого проекта");
    expect(failures(checkEnv({ ...GOOD_ENV, E2E_SUPABASE_PROJECT_REF: "other" }))[0]).toContain(
      "E2E_SUPABASE_PROJECT_REF",
    );
    expect(
      failures(
        checkEnv({
          ...GOOD_ENV,
          SUPABASE_SECRET_KEY: GOOD_ENV.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        }),
      )[0],
    ).toContain("совпадает");
  });
});

describe("настройки Auth", () => {
  it("открытые: по чек-листу — ✓; наоборот — ✗; нет поля — ?", () => {
    const good = {
      external: { email: true, anonymous_users: false },
      disable_signup: true,
      mailer_autoconfirm: true,
    };
    expect(statuses(checkAuthSettings(good))).toEqual(["ok", "ok", "ok", "ok"]);
    const bad = {
      external: { email: false, anonymous_users: true },
      disable_signup: false,
      mailer_autoconfirm: false,
    };
    expect(statuses(checkAuthSettings(bad))).toEqual(["fail", "fail", "fail", "fail"]);
    expect(statuses(checkAuthSettings({}))).toEqual(["manual", "manual", "manual", "manual"]);
  });

  it("JWT-ключи: EC или RSA — ✓, пусто (HS256) — ✗", () => {
    expect(checkJwks({ keys: [{ kty: "EC", alg: "ES256" }] }).status).toBe("ok");
    expect(checkJwks({ keys: [] }).status).toBe("fail");
    expect(checkJwks(null).status).toBe("fail");
  });

  it("закрытые: длина пароля сверена с кабинетом, Secure password change, пересылка IP", () => {
    const good = {
      password_min_length: PASSWORD_RULES.minLength,
      security_update_password_require_reauthentication: false,
      security_sb_forwarded_for_enabled: true,
    };
    expect(statuses(checkAuthConfig(good))).toEqual(["ok", "ok", "ok"]);
    const short = {
      ...good,
      password_min_length: PASSWORD_RULES.minLength - 1,
      security_sb_forwarded_for_enabled: false,
    };
    expect(statuses(checkAuthConfig(short))).toEqual(["fail", "ok", "fail"]);
    expect(statuses(manualAuthConfig())).toEqual(["manual", "manual", "manual"]);
  });
});

describe("база", () => {
  const local = ["20261018221850", "20261020120000"];

  const pushed = { applied: local, local, edited: [] };

  it("до db:push — ✗ миграции, DEMO и руководитель не проверяются", () => {
    expect(
      checkDatabase({ applied: [], local, edited: [], demoComplexes: null, activeHeads: null }),
    ).toEqual([
      expect.objectContaining({
        status: "fail",
        text: "миграции: в облаке 0 из 2",
        hint: "npm run db:push",
      }),
    ]);
  });

  it("после db:push — следующий шаг подсказывается по порядку", () => {
    const lines = checkDatabase({ ...pushed, demoComplexes: 0, activeHeads: 0 });
    expect(lines.map((line) => line.hint)).toEqual([
      undefined,
      "npm run demo:seed",
      expect.stringContaining("staff:create-head"),
    ]);
    expect(statuses(checkDatabase({ ...pushed, demoComplexes: 4, activeHeads: 1 }))).toEqual([
      "ok",
      "ok",
      "ok",
    ]);
  });

  it("применённую миграцию изменили в файле — ✗, хотя все версии в облаке есть (2.9б)", () => {
    const lines = checkDatabase({
      ...pushed,
      edited: ["20261020120000"],
      demoComplexes: 4,
      activeHeads: 1,
    });
    expect(statuses(lines)).toEqual(["ok", "fail", "ok", "ok"]);
    expect(lines[1]).toMatchObject({
      text: "миграции изменены после применения: 20261020120000",
      hint: expect.stringContaining("новым файлом миграции"),
    });
  });

  it("в облаке версии, которых нет в ветке, — ✗ (код и база разошлись)", () => {
    const lines = checkDatabase({
      ...pushed,
      applied: [...local, "20261102190000"],
      demoComplexes: 4,
      activeHeads: 1,
    });
    expect(statuses(lines)).toEqual(["ok", "fail", "ok", "ok"]);
    expect(lines[1]?.text).toContain("20261102190000");
  });

  it("прод: DEMO не нужен, руководитель — ? до встречи", () => {
    expect(statuses(checkDatabase({ ...pushed, demoComplexes: 0, activeHeads: 0 }, true))).toEqual([
      "ok",
      "manual",
    ]);
  });
});

describe("прод (--prod)", () => {
  const clean = {
    demo: 0,
    e2eUsers: 0,
    leads: 0,
    nextLeadNumber: 1001,
    incompletePublished: [],
    rate: true,
  };

  it("чистый прод — всё ✓", () => {
    expect(statuses(checkProd(clean))).toEqual(["ok", "ok", "ok", "ok", "ok", "ok"]);
  });

  it("DEMO, сотрудники e2e и неполный опубликованный ЖК — ✗; заявки, счётчик и курс — ?", () => {
    const lines = checkProd({
      demo: 3,
      e2eUsers: 2,
      leads: 1,
      nextLeadNumber: 1002,
      incompletePublished: ["shodlik"],
      rate: false,
    });
    expect(statuses(lines)).toEqual(["fail", "fail", "manual", "manual", "fail", "manual"]);
    expect(lines[4]?.text).toContain("shodlik");
  });

  it("запрос не прошёл (до db:push, нет прав) — ✗, а не пропуск строки", () => {
    const lines = checkProd({
      demo: null,
      e2eUsers: null,
      leads: null,
      nextLeadNumber: null,
      incompletePublished: null,
      rate: null,
    });
    expect(statuses(lines)).toEqual(["fail", "fail", "fail", "fail", "fail", "fail"]);
  });

  it("E2E_SUPABASE_PROJECT_REF прода — ✗, пусто — ✓", () => {
    const url = "https://abcdefghijklmnopqrst.supabase.co";
    const e2eLine = (value: string | undefined) =>
      checkEnv({ NEXT_PUBLIC_SUPABASE_URL: url, E2E_SUPABASE_PROJECT_REF: value }, true).find(
        (line) => line.text.startsWith("E2E_SUPABASE_PROJECT_REF"),
      );
    expect(e2eLine("abcdefghijklmnopqrst")?.status).toBe("fail");
    expect(e2eLine(undefined)?.status).toBe("ok");
  });
});
