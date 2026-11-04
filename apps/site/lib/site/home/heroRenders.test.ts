import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  HERO_RENDER_SIZES,
  HERO_RENDERS,
  HERO_SIZES,
  renderSrc,
  renderSrcSet,
} from "./heroRenders";

const PUBLIC = path.join(import.meta.dirname, "../../../public");

describe("heroRenders", () => {
  it("пять кадров, первый — бронзовая башня (LCP)", () => {
    expect(HERO_RENDERS).toHaveLength(5);
    expect(HERO_RENDERS[0]?.slug).toBe("bronze-tower-sunset");
    expect(new Set(HERO_RENDERS.map((render) => render.slug)).size).toBe(5);
  });

  it("наборы 480 и 736 в AVIF и WebP; файлы лежат в public", () => {
    for (const { slug } of HERO_RENDERS) {
      expect(renderSrcSet(slug, "avif")).toBe(
        `/hero/renders/v1/${slug}-480.avif 480w, /hero/renders/v1/${slug}-736.avif 736w`,
      );
      expect(renderSrc(slug)).toBe(`/hero/renders/v1/${slug}-736.webp`);
      for (const file of [
        `${slug}-480.avif`,
        `${slug}-736.avif`,
        `${slug}-480.webp`,
        `${slug}-736.webp`,
      ])
        expect(existsSync(path.join(PUBLIC, "hero/renders/v1", file)), file).toBe(true);
    }
  });

  it("размеры — по рамке центральной башни", () => {
    expect(HERO_RENDER_SIZES).toBe(HERO_SIZES.c);
    expect(HERO_RENDER_SIZES.startsWith("(min-width: 1024px) 560px")).toBe(true);
  });
});
