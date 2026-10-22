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

// Git на Windows (autocrlf) отдаёт файлы с CRLF — разбираем текст с одними LF.
const readSource = (file: string) =>
  readFileSync(path.join(DIR, file), "utf8").replace(/\r\n/g, "\n");

function exportedFunctions(source: string): { name: string; body: string }[] {
  const pattern = /export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g;
  return [...source.matchAll(pattern)].map((match) => ({ name: match[1]!, body: match[2]! }));
}

describe("Server Actions кабинета", () => {
  it.each(files)('%s: только async-функции и "use server" первой строкой', (file) => {
    const source = readSource(file);
    expect(source.startsWith('"use server";')).toBe(true);
    const exports = [...source.matchAll(/^export (?!async function)(.+)$/gm)].map(
      (match) => match[1],
    );
    expect(exports).toEqual([]);
  });

  it.each(files)("%s: каждое действие первой строкой проверяет сотрудника", (file) => {
    const source = readSource(file);
    const actions = exportedFunctions(source);
    expect(actions.length).toBeGreaterThan(0);
    for (const { name, body } of actions) {
      if (WITHOUT_SESSION.has(name)) continue;
      const firstLine =
        body.split("\n").find((line) => line.trim() && !line.trim().startsWith("//")) ?? "";
      expect(firstLine, name).toMatch(GUARD);
    }
  });

  // Квартиры (Н2, Н7, PLAN §5): читают все сотрудники; менеджеру ещё статус, «Отменить» и
  // наличие планировки; остальное — руководителю. База проверит роль ещё раз, но этот слой не
  // должен расшириться молча.
  it("квартиры: роли действий — по Н2, Н7 и PLAN §5", () => {
    const guards: Record<string, string> = {
      readBlockUnitsAction: 'requireActionViewer(["head", "manager", "videographer"])',
      setUnitsStatusAction: 'requireActionViewer(["head", "manager"])',
      revertUnitsStatusAction: 'requireActionViewer(["head", "manager"])',
      setLayoutAvailableAction: 'requireActionViewer(["head", "manager"])',
    };
    for (const file of ["units.ts", "unitsList.ts", "unitsMass.ts", "unitsStatus.ts"]) {
      const source = readSource(file);
      for (const { name, body } of exportedFunctions(source)) {
        const guard = guards[name] ?? "headGuard()";
        expect(body, name).toContain(`const guard = await ${guard};`);
        if (guard === "headGuard()")
          expect(source, file).toContain('const headGuard = () => requireActionViewer(["head"]);');
      }
    }
  });

  it("headGuard сам спрашивает Auth заново (fresh) и пускает только руководителя", () => {
    const source = readSource("staff.ts");
    expect(source).toMatch(/requireActionViewer\(\["head"\], \{ fresh: true \}\)/);
  });
});
