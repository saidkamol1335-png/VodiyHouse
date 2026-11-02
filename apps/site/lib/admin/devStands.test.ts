import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Стенды /dev и их действия — только для разработки. Приёмка фазы 1 (22.10.2026): стенд, который
// сначала ждал searchParams, звал notFound() уже после статичной оболочки — в продакшене ответ
// уходил с кодом 200. Теперь первый рубеж — корневой layout /dev, второй — devOnly в действиях.

const DEV_DIR = path.join("app", "dev");
const readSource = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function actionFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return actionFiles(full);
    return /actions\.ts$/i.test(entry.name) ? [full] : [];
  });
}

const PRODUCTION_GUARD =
  /^\s*(devOnly\(\);|if \(process\.env\.NODE_ENV === "production"\) throw new Error\()/;

describe("стенды /dev в продакшене закрыты", () => {
  it("корневой layout /dev — 404 в продакшене до всего остального", () => {
    const body = readSource(path.join(DEV_DIR, "layout.tsx")).split("export default function")[1]!;
    const firstLine = body
      .split("\n")
      .find((line) => line.trim().startsWith("if") || line.includes("return"));
    expect(firstLine?.trim()).toBe('if (process.env.NODE_ENV === "production") notFound();');
  });

  const files = actionFiles(DEV_DIR);

  it.each(files)("%s: каждое действие первой строкой проверяет, что это не продакшен", (file) => {
    const source = readSource(file);
    const actions = [
      ...source.matchAll(/export async function (\w+)\([^)]*\)[^{]*\{\n([\s\S]*?)\n\}/g),
    ];
    expect(actions.length).toBeGreaterThan(0);
    for (const [, name, body] of actions) {
      const first = body!.split("\n").find((line) => line.trim() && !line.trim().startsWith("//"));
      expect(first, name).toMatch(PRODUCTION_GUARD);
    }
  });
});
