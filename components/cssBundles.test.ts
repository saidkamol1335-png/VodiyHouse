import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { componentOf, reachableModules, readSource, routeFiles } from "@/tests/unit/importGraph";

// CSS по разделам (шаг 14в): сайт не грузит кабинет, вход — только своё. Компонент, который
// попадёт на страницу без своего CSS, выглядел бы сломанным только там — тест ловит это сразу.

const BUNDLES = ["globals", "site", "admin", "cabinet", "dev"] as const;
type Bundle = (typeof BUNDLES)[number];

/** Какие разделы грузит корень маршрутов — в порядке каскада. */
const ROOTS: Record<string, { entries: string[]; bundles: Bundle[] }> = {
  site: {
    entries: [...routeFiles("app/[locale]"), "app/global-not-found.tsx"],
    bundles: ["globals", "site"],
  },
  adminRoot: {
    entries: ["layout.tsx", "error.tsx", "vhod/page.tsx", "parol/page.tsx"].map(
      (f) => `app/admin/${f}`,
    ),
    bundles: ["globals", "admin"],
  },
  cabinet: { entries: routeFiles("app/admin/(cabinet)"), bundles: ["globals", "admin", "cabinet"] },
  dev: { entries: routeFiles("app/dev"), bundles: [...BUNDLES] },
};

const LAYOUT_CSS: Record<string, Bundle[]> = {
  "app/[locale]/layout.tsx": ["globals", "site"],
  "app/global-not-found.tsx": ["globals", "site"],
  "app/admin/layout.tsx": ["globals", "admin"],
  "app/admin/(cabinet)/layout.tsx": ["cabinet"],
  "app/dev/layout.tsx": [...BUNDLES],
};

const bundleImports = (bundle: Bundle) =>
  [...readSource(`app/${bundle}.css`).matchAll(/@import "\.\.\/components\/([^"]+)";/g)].map(
    (match) => match[1]!,
  );

const componentCss = readdirSync("components", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name !== "ui")
  .flatMap((entry) =>
    readdirSync(path.join("components", entry.name))
      .filter((file) => file.endsWith(".css"))
      .map((file) => `${entry.name}/${file}`),
  );

describe("CSS по разделам", () => {
  const owner = new Map<string, Bundle[]>();
  for (const bundle of BUNDLES) {
    for (const file of bundleImports(bundle)) owner.set(file, [...(owner.get(file) ?? []), bundle]);
  }

  it("каждый CSS компонента подключён ровно в одном разделе", () => {
    expect(componentCss.filter((file) => owner.get(file)?.length !== 1)).toEqual([]);
    expect([...owner.keys()].filter((file) => !componentCss.includes(file))).toEqual([]);
  });

  it("корневые layout подключают свои разделы в порядке каскада", () => {
    for (const [layout, bundles] of Object.entries(LAYOUT_CSS)) {
      const imported = [...readSource(layout).matchAll(/^import "(?:\.\.?\/)+(\w+)\.css";$/gm)];
      expect(
        imported.map((match) => match[1]),
        layout,
      ).toEqual(bundles);
    }
  });

  it.each(Object.entries(ROOTS))("%s: у каждого компонента страницы есть свой CSS", (_, root) => {
    const components = new Set(reachableModules(root.entries).map(componentOf).filter(Boolean));
    const missing = componentCss.filter((file) => {
      if (!components.has(file.split("/")[0]!)) return false;
      return !owner.get(file)?.some((bundle) => root.bundles.includes(bundle));
    });
    expect(missing).toEqual([]);
  });
});
