import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSource } from "@/tests/unit/importGraph";

// БЭМ без CSS Modules (CLAUDE.md §1): уникальность имён даёт только префикс блока. Блок с тем же
// именем в двух компонентах (сайт «ЖК» и вкладка кабинета) сливает стили там, где грузятся оба
// набора — на стендах /dev, по которым идут e2e кабинета. Блок — в одной папке компонента.

const blockOf = (selector: string) => selector.split(/__|--/)[0]!;

function blocksByComponent(): Map<string, Set<string>> {
  const owners = new Map<string, Set<string>>();
  for (const entry of readdirSync("components", { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of readdirSync(path.join("components", entry.name)).filter((name) => name.endsWith(".css"))) {
      const css = readSource(path.join("components", entry.name, file));
      // Только селекторы в начале правила: внутри чужого блока (миксы, :has) — не определение.
      for (const [, selector] of css.matchAll(/^\.([a-z][a-z0-9-]*(?:__[a-z0-9-]+)?(?:--[a-z0-9-]+)?)/gm)) {
        const block = blockOf(selector!);
        owners.set(block, (owners.get(block) ?? new Set()).add(entry.name));
      }
    }
  }
  return owners;
}

describe("БЭМ-блоки", () => {
  it("каждый блок определён в одной папке компонента", () => {
    const shared = [...blocksByComponent()].filter(([, folders]) => folders.size > 1).map(([block, folders]) => `${block}: ${[...folders].join(", ")}`);
    expect(shared).toEqual([]);
  });
});
