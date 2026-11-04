import { describe, expect, it } from "vitest";
import type { CatalogComplex } from "@/lib/site/catalog/records";
import { projectComplexes, projectWidth } from "./projects";

const complex = (slug: string, state: "full" | "soon" = "full", photo = true) =>
  ({ slug, state, photos: photo ? [{ path: `${slug}.jpg` }] : [] }) as unknown as CatalogComplex;

describe("«Проекты Vodiy House» — какие ЖК в ленте", () => {
  it("только «полные» с обложкой; меньше трёх — ленты нет", () => {
    expect(projectComplexes([complex("a"), complex("b"), complex("c", "soon")])).toEqual([]);
    expect(
      projectComplexes([complex("a"), complex("b"), complex("c"), complex("d", "full", false)]).map(
        (item) => item.slug,
      ),
    ).toEqual(["a", "b", "c"]);
  });

  it("ширины по кругу: 60 / 70vw", () => {
    expect([0, 1, 2, 3].map(projectWidth)).toEqual(["base", "wide", "base", "wide"]);
  });
});
