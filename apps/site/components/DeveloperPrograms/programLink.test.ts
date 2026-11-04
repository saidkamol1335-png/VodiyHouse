import { describe, expect, it } from "vitest";
import { programHref } from "./programLink";

// «Рассчитать платёж» ведёт на ЖК, а не на /kalkulyator (PLAN §10, п. 48).

const shodlik = { slug: "shodlik", blockIds: ["a", "b"] };
const sayilgoh = { slug: "sayilgoh", blockIds: ["c"] };

describe("ссылка программы застройщика", () => {
  it("программа на все блоки, ЖК один — планировки этого ЖК", () => {
    expect(programHref({ blocksScope: "all", blockIds: [] }, [shodlik])).toBe(
      "/novostroyki/shodlik#planirovki",
    );
  });

  it("программа на блоки одного ЖК из двух — этот ЖК", () => {
    expect(programHref({ blocksScope: "selected", blockIds: ["c"] }, [shodlik, sayilgoh])).toBe(
      "/novostroyki/sayilgoh#planirovki",
    );
  });

  it("несколько ЖК — к объектам застройщика на этой же странице", () => {
    expect(programHref({ blocksScope: "all", blockIds: [] }, [shodlik, sayilgoh])).toBe("#obekty");
  });

  it("ЖК на сайте нет — ссылки нет", () => {
    expect(programHref({ blocksScope: "selected", blockIds: ["z"] }, [shodlik])).toBeNull();
    expect(programHref({ blocksScope: "all", blockIds: [] }, [])).toBeNull();
  });
});
