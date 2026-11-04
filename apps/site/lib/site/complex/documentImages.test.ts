import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOCUMENT_IMAGE_KEYS, documentImageKey, documentImageSrc, documentImageSrcSet } from "./documentImages";

const PUBLIC = path.join(__dirname, "../../../public");

describe("documentImages", () => {
  it("известный тип — свой кадр, неизвестный — общий", () => {
    expect(documentImageKey("land")).toBe("land");
    expect(documentImageKey("sanitary")).toBe("generic");
  });

  it("каждый кадр лежит в public в обоих форматах и размерах", () => {
    for (const key of DOCUMENT_IMAGE_KEYS) {
      for (const format of ["avif", "webp"] as const) {
        for (const entry of documentImageSrcSet(key, format).split(", ")) {
          expect(existsSync(path.join(PUBLIC, entry.split(" ")[0] ?? ""))).toBe(true);
        }
      }
      expect(documentImageSrc(key)).toBe(`/docs-hover/v2/${key}-512.webp`);
    }
  });
});
