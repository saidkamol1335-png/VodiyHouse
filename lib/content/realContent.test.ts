// @vitest-environment node
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { COMPLEX_NAME_MAX } from "@/lib/admin/complexes/create";
import { MEDIA_KIND_RULES as MEDIA_RULES } from "@/lib/media/rules";
import { slugify } from "@/lib/slug";

// Настоящие ЖК для `npm run content:import` (docs/zhk/content.json): та же проверка, что прошла бы
// загрузка в кабинете — адреса из названий, застройщики есть, файлы на месте и не мельче порогов
// (первое фото — обложка ≥ 2400 px, фасад ≥ 2400 px), ничего с пометкой DEMO.

const ZHK_DIR = path.resolve(import.meta.dirname, "../../docs/zhk");

type Content = {
  developers: { slug: string; name: string }[];
  complexes: { slug: string; name: string; developer: string; photos: string[]; facade?: string }[];
};

const content = JSON.parse(await readFile(path.join(ZHK_DIR, "content.json"), "utf8")) as Content;
const longSide = async (file: string) => {
  const { width = 0, height = 0 } = await sharp(path.join(ZHK_DIR, file)).metadata();
  return Math.max(width, height);
};

describe("настоящие ЖК из материалов заказчика", () => {
  it("адреса — из названий, без demo-, названия ЖК не длиннее кабинетных; застройщики на месте", () => {
    const developers = new Set(content.developers.map((developer) => developer.slug));
    for (const developer of content.developers) expect(developer.slug).toBe(slugify(developer.name));
    for (const complex of content.complexes) {
      expect(complex.slug, complex.name).toBe(slugify(complex.name));
      expect(complex.slug).not.toMatch(/^demo/);
      expect(complex.name.length).toBeLessThanOrEqual(COMPLEX_NAME_MAX);
      expect(developers.has(complex.developer), complex.slug).toBe(true);
    }
    expect(new Set(content.complexes.map((complex) => complex.slug)).size).toBe(content.complexes.length);
  });

  it("фото и фасады — файлы из docs/zhk, не мельче порогов кабинета", async () => {
    for (const complex of content.complexes) {
      for (const [index, file] of complex.photos.entries()) {
        expect(existsSync(path.join(ZHK_DIR, file)), file).toBe(true);
        const min = index === 0 ? MEDIA_RULES.cover.minLongSide : MEDIA_RULES.photo.minLongSide;
        expect(await longSide(file), file).toBeGreaterThanOrEqual(min);
      }
      if (complex.facade) expect(await longSide(complex.facade), complex.facade).toBeGreaterThanOrEqual(MEDIA_RULES.facade.minLongSide);
    }
  });
});
