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
    ignores: ["lib/admin/server/**", "lib/supabase/admin.ts", "lib/supabase/env.test.ts"],
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
              message: "Секретный ключ читает только lib/supabase/admin.ts.",
            },
          ],
        },
      ],
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
