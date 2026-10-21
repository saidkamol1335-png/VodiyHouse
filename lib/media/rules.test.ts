import { describe, expect, it } from "vitest";
import {
  MEDIA_KINDS,
  MEDIA_KIND_RULES,
  canBeComplexCover,
  checkResolution,
  checkSourceFile,
  checkStoredSize,
} from "./rules";

const MB = 1024 * 1024;

describe("правила фото · исходник", () => {
  it("принимает JPEG, PNG и WebP до 25 МБ включительно", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(checkSourceFile({ type, size: 25 * MB })).toBeNull();
    }
  });

  it("отклоняет HEIC, GIF, PDF и файл без типа", () => {
    for (const type of ["image/heic", "image/gif", "application/pdf", ""]) {
      expect(checkSourceFile({ type, size: MB })).toEqual({ code: "unsupportedType" });
    }
  });

  it("отклоняет тяжелее 25 МБ до декодирования", () => {
    expect(checkSourceFile({ type: "image/jpeg", size: 25 * MB + 1 })).toEqual({
      code: "sourceTooLarge",
      maxMegabytes: 25,
    });
  });
});

describe("правила фото · разрешение (PLAN 3а)", () => {
  it("фото 800 px отклоняется для всех видов фото — приёмка фазы 1", () => {
    for (const kind of ["photo", "cover", "facade", "drawing"] as const) {
      expect(checkResolution({ width: 800, height: 600 }, kind)).toEqual({
        code: "resolutionTooLow",
        longSide: 800,
        minLongSide: MEDIA_KIND_RULES[kind].minLongSide,
      });
    }
  });

  it("пороги по длинной стороне: галерея 1600, обложка и фасад 2400, чертёж 1200, логотип 400", () => {
    const minimums = Object.fromEntries(
      MEDIA_KINDS.map((kind) => [kind, MEDIA_KIND_RULES[kind].minLongSide]),
    );
    expect(minimums).toEqual({ photo: 1600, cover: 2400, facade: 2400, drawing: 1200, logo: 400 });
  });

  it("вертикальное фото считается по длинной стороне", () => {
    expect(checkResolution({ width: 1200, height: 1600 }, "photo")).toBeNull();
    expect(checkResolution({ width: 1599, height: 1200 }, "photo")?.code).toBe("resolutionTooLow");
  });

  it("обложкой ЖК встаёт только фото от 2400 px", () => {
    expect(canBeComplexCover({ width: 2399, height: 1600 })).toBe(false);
    expect(canBeComplexCover({ width: 1600, height: 2400 })).toBe(true);
  });

  it("предел уменьшения не меньше порога; логотип и чертёж — PNG, фото — JPEG; прозрачен только логотип", () => {
    for (const kind of MEDIA_KINDS) {
      const rule = MEDIA_KIND_RULES[kind];
      expect(rule.maxLongSide).toBeGreaterThanOrEqual(rule.minLongSide);
      expect(rule.output).toBe(kind === "logo" || kind === "drawing" ? "image/png" : "image/jpeg");
      // Чертёж — белый лист: подписи площадей не теряются на тёмном фоне сайта.
      expect(rule.opaque).toBe(kind !== "logo");
    }
  });

  it("уменьшенный файл тяжелее 15 МБ (лимит бакета) отклоняется", () => {
    expect(checkStoredSize(15 * MB)).toBeNull();
    expect(checkStoredSize(15 * MB + 1)).toEqual({ code: "storedTooLarge", maxMegabytes: 15 });
  });
});
