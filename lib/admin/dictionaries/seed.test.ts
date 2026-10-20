// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SEED_DICTIONARIES } from "./seed";

const MIGRATION = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../../../supabase/migrations/20261019160000_staff_dictionaries_audit.sql",
  ),
  "utf8",
);

describe("стенд справочников = начальные данные миграции", () => {
  it("каждое значение стенда есть в миграции с тем же адресом и названием", () => {
    for (const items of Object.values(SEED_DICTIONARIES)) {
      for (const item of items) {
        expect(MIGRATION).toContain(
          `'${item.slug}', '{"ru": "${item.name.ru}", "uz": "${item.name.uz}"}'`,
        );
      }
    }
  });
});
