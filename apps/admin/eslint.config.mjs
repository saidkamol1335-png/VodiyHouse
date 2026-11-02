import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Клиент с секретным ключом обходит RLS — только серверные адаптеры кабинета. patterns, а не
// paths: ловят и относительный импорт (../supabase/admin), и сам ключ из env.
const secretImportPatterns = [
  {
    group: ["**/supabase/admin", "**/supabase/admin.ts"],
    message: "Ключ service_role — только в lib/admin/server/*: там проверены права сотрудника.",
  },
  {
    group: ["**/supabase/env", "**/supabase/env.ts", "./env"],
    importNames: ["supabaseSecretKey"],
    message: "Секретный ключ читают только lib/supabase/admin.ts и authForwarding.ts.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "lib/admin/server/**",
      // Заявки посетителя без входа и расписание: прав сотрудника нет, проверяет база (submit_lead и
      // очередь доставки открыты только серверу). В браузер модули не попадают (server-only).
      "lib/leads/server/**",
      // События сайта (3.12): посетитель без входа, track_events открыт только серверу.
      "lib/events/server/**",
      // Окончательное удаление архива (3.13): расписание без сотрудника, функции открыты только серверу.
      "lib/archive/server/**",
      "lib/supabase/admin.ts",
      "lib/supabase/authForwarding.ts",
      "lib/supabase/env.test.ts",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: secretImportPatterns }],
    },
  },
  {
    // e2e переходят по страницам только общим `test` (tests/e2e/fixtures.ts): он ждёт, пока React
    // оживёт, иначе клик на dev-сервере под нагрузкой уходит в пустоту.
    files: ["tests/e2e/**/*.ts"],
    ignores: ["tests/e2e/fixtures.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@playwright/test",
              importNames: ["test"],
              message: "Переходы e2e ждут оживления страницы: import { test } from './fixtures'.",
            },
          ],
          patterns: secretImportPatterns,
        },
      ],
    },
  },
  {
    // Пересылка IP в Auth берёт секретный ключ только для запросов сотрудника к Auth; клиент
    // с правами service_role ей не нужен.
    files: ["lib/supabase/authForwarding.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/supabase/admin", "**/supabase/admin.ts", "./admin"],
              message: "Ключ service_role — только в lib/admin/server/*: там проверены права сотрудника.",
            },
          ],
        },
      ],
    },
  },
  {
    // CLAUDE.md §1: функция — до ~40 строк, файл — до ~250. «~»: 45 без пустых строк и комментариев
    // (подпись компонента с разбором пропсов — уже 8–10 строк). Тесты и shadcn/ui — не наш код
    // правил: describe-блоки длинные по природе.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}", "components/ui/**"],
    rules: {
      "max-lines-per-function": ["error", { max: 45, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    // Netlify CLI: сборка деплоя и установленные плагины — сгенерированный и чужой код.
    ".netlify/**",
    // Выгрузка холста мокапа — чужой код, не наш.
    "docs/mockup/source/**",
  ]),
]);

export default eslintConfig;
