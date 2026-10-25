import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Клиент с секретным ключом обходит RLS — только серверные адаптеры кабинета. patterns, а не
    // paths: ловят и относительный импорт (../supabase/admin), и сам ключ из env.
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "lib/admin/server/**",
      // Заявки посетителя без входа и расписание: прав сотрудника нет, проверяет база (submit_lead и
      // очередь доставки открыты только серверу). В браузер модули не попадают (server-only).
      "lib/leads/server/**",
      "lib/supabase/admin.ts",
      "lib/supabase/authForwarding.ts",
      "lib/supabase/env.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/supabase/admin", "**/supabase/admin.ts"],
              message: "Ключ service_role — только в lib/admin/server/*: там проверены права сотрудника.",
            },
            {
              group: ["**/supabase/env", "**/supabase/env.ts", "./env"],
              importNames: ["supabaseSecretKey"],
              message: "Секретный ключ читают только lib/supabase/admin.ts и authForwarding.ts.",
            },
          ],
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
    // Выгрузка холста мокапа — чужой код, не наш.
    "docs/mockup/source/**",
  ]),
]);

export default eslintConfig;
