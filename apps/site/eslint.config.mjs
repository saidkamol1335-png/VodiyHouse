import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Сайт без service-ключа и кабинета (PLAN §10): ни один модуль не берёт клиент service_role, его
// ключ или код кабинета — без исключений. patterns, а не paths: ловят и относительный импорт.
const secretImportPatterns = [
  {
    group: ["**/supabase/admin", "**/supabase/admin.ts", "**/lib/admin/**", "@supabase/ssr"],
    message: "У сайта нет service-ключа и кабинета (PLAN §10): чтение — функции site_*, запись — lib/supabase/signedWrite.ts.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
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
