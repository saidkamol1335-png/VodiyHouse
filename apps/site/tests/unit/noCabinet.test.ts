import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSource, reachableModules, routeFiles } from "@/tests/unit/importGraph";

// Проект-2 (PLAN §10): сайт — чистый. Кабинет, cron, бот и service-ключ живут в apps/admin;
// сайт пишет в базу только подписанными функциями (lib/supabase/signedWrite.ts) и не ведёт в кабинет.

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|mts)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const code = ["app", "components", "lib"].flatMap(sourceFiles);

describe("сайт без кабинета", () => {
  it("нет кода кабинета, service-ключа и клиента с правами service_role", () => {
    const offending = code.filter((file) =>
      /@\/lib\/admin|supabase\/admin|SUPABASE_SECRET_KEY|createSupabaseAdminClient|@supabase\/ssr/.test(readSource(file)),
    );
    expect(offending).toEqual([]);
  });

  it("маршрутов кабинета, расписаний и бота нет", () => {
    const routes = routeFiles("app").map((file) => file.split(path.sep).join("/"));
    expect(routes.filter((file) => /^app\/(admin|api\/(cron|telegram|predprosmotr))\//.test(file))).toEqual([]);
  });

  it("страницы сайта не достигают DEMO стендов калькулятора (lib/devDemo — только /dev)", () => {
    const reached = reachableModules(routeFiles("app/[locale]")).map((file) => file.split(path.sep).join("/"));
    expect(reached.length).toBeGreaterThan(0);
    expect(reached.filter((file) => file.includes("/lib/devDemo/"))).toEqual([]);
  });
});
