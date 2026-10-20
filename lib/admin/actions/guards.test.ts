import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Server Action — открытый POST: страница его не защищает. Правило шага 8: первое, что делает
// действие кабинета, — проверяет сотрудника (requireActionViewer или headGuard поверх него).
// Вход и выход — без сессии по смыслу.
const DIR = path.join("lib", "admin", "actions");
const WITHOUT_SESSION = new Set(["signInAction", "signOutAction"]);
const GUARD = /^\s*const guard = await (requireActionViewer|headGuard)\(/;

const files = readdirSync(DIR).filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));

function exportedFunctions(source: string): { name: string; body: string }[] {
  const pattern = /export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g;
  return [...source.matchAll(pattern)].map((match) => ({ name: match[1]!, body: match[2]! }));
}

describe("Server Actions кабинета", () => {
  it.each(files)("%s: только async-функции и \"use server\" первой строкой", (file) => {
    const source = readFileSync(path.join(DIR, file), "utf8");
    expect(source.startsWith('"use server";')).toBe(true);
    const exports = [...source.matchAll(/^export (?!async function)(.+)$/gm)].map((match) => match[1]);
    expect(exports).toEqual([]);
  });

  it.each(files)("%s: каждое действие первой строкой проверяет сотрудника", (file) => {
    const source = readFileSync(path.join(DIR, file), "utf8");
    const actions = exportedFunctions(source);
    expect(actions.length).toBeGreaterThan(0);
    for (const { name, body } of actions) {
      if (WITHOUT_SESSION.has(name)) continue;
      const firstLine = body.split("\n").find((line) => line.trim() && !line.trim().startsWith("//")) ?? "";
      expect(firstLine, name).toMatch(GUARD);
    }
  });

  it("headGuard сам спрашивает Auth заново (fresh) и пускает только руководителя", () => {
    const source = readFileSync(path.join(DIR, "staff.ts"), "utf8");
    expect(source).toMatch(/requireActionViewer\(\["head"\], \{ fresh: true \}\)/);
  });
});
