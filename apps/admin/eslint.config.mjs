import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Админка не берёт код сайта: общее — только @vh/shared (PLAN §10, CLAUDE.md «Код»).
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/apps/site/**", "@vh/site", "@vh/site/**"],
              message: "Админка не импортирует код сайта: общее — в packages/shared.",
            },
          ],
        },
      ],
    },
  },
  {
    // Те же лимиты длины, что у сайта (apps/site/eslint.config.mjs).
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "max-lines-per-function": ["error", { max: 45, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);

export default eslintConfig;
