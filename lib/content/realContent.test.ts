// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BLOCK_LIMITS } from "@/lib/admin/complexes/blocks";
import { COMPLEX_NAME_MAX } from "@/lib/admin/complexes/create";
import { DETAIL_LIMITS } from "@/lib/admin/complexes/details";
import { COMPLEX_LIMITS } from "@/lib/admin/complexes/mainForm";
import { containsContact } from "@/lib/admin/contactGuard";
import { DEVELOPER_LIMITS } from "@/lib/admin/developers/mainForm";
import { mentionsDiscount } from "@/lib/admin/discountGuard";
import { MEDIA_KIND_RULES as MEDIA_RULES } from "@/lib/media/rules";
import { NEARBY_KINDS, NEARBY_LIMITS } from "@/lib/site/complex/nearby";
import { slugify } from "@/lib/slug";
import { blockLayoutKeys, siteUnitRows, unitRows, type UnitsFile } from "./units";

// Настоящие ЖК для `npm run content:import` (docs/zhk/content.json): та же проверка, что прошла бы
// загрузка в кабинете — адреса из названий, застройщики есть, файлы на месте и не мельче порогов
// (первое фото — обложка ≥ 2400 px, фасад ≥ 2400 px), тексты в пределах и без контактов застройщика
// (правило 1.2), без скидок (PLAN §3.13), квартиры и цены сходятся, ничего с пометкой DEMO.

const ZHK_DIR = path.resolve(import.meta.dirname, "../../docs/zhk");

type Text = { ru: string; uz: string };
type Block = {
  name: string;
  status: string;
  floorsTotal: number;
  floorsBuilt?: number;
  deadline?: [number, number];
  currency: string;
  includes?: { item: Text; included: boolean; price?: number }[];
  layouts?: { rooms: number; area: number; priceFrom?: number; available?: boolean }[];
};
type Complex = {
  slug: string;
  name: string;
  developer: string;
  publish?: boolean;
  photos: string[];
  facade?: string;
  address?: Text;
  landmark?: Text;
  minutesToCenter?: number;
  ceilingHeight?: number;
  point?: [number, number];
  nearby?: { kind: string; name: Text; minutes: number }[];
  details?: Record<string, Text>;
  documents?: { checkedOn: string; types: string[] } | null;
  units?: string;
  blocks: Block[];
  progress?: { month: string; block: string; comment: Text; photos: string[] }[];
};
type Developer = {
  slug: string;
  name: string;
  about?: Text;
  logo?: string;
  publish?: boolean;
  pastProjects?: { name: Text }[];
};
type Content = { developers: Developer[]; complexes: Complex[] };

const content = JSON.parse(await readFile(path.join(ZHK_DIR, "content.json"), "utf8")) as Content;
const longSide = async (file: string) => {
  const { width = 0, height = 0 } = await sharp(path.join(ZHK_DIR, file)).metadata();
  return Math.max(width, height);
};
const texts = (value: Text | undefined | null) => (value ? [value.ru, value.uz] : []);
const unitsOf = (complex: Complex) =>
  complex.units
    ? (JSON.parse(readFileSync(path.join(ZHK_DIR, complex.units), "utf8")) as UnitsFile)
    : null;

describe("настоящие ЖК из материалов заказчика", () => {
  it("адреса — из названий, без demo-, названия ЖК не длиннее кабинетных; застройщики на месте", () => {
    const developers = new Set(content.developers.map((developer) => developer.slug));
    for (const developer of content.developers)
      expect(developer.slug).toBe(slugify(developer.name));
    for (const complex of content.complexes) {
      expect(complex.slug, complex.name).toBe(slugify(complex.name));
      expect(complex.slug).not.toMatch(/^demo/);
      expect(complex.name.length).toBeLessThanOrEqual(COMPLEX_NAME_MAX);
      expect(developers.has(complex.developer), complex.slug).toBe(true);
    }
    expect(new Set(content.complexes.map((complex) => complex.slug)).size).toBe(
      content.complexes.length,
    );
  });

  it("фото и фасады — файлы из docs/zhk, не мельче порогов кабинета", async () => {
    for (const complex of content.complexes) {
      for (const [index, file] of complex.photos.entries()) {
        expect(existsSync(path.join(ZHK_DIR, file)), file).toBe(true);
        const min = index === 0 ? MEDIA_RULES.cover.minLongSide : MEDIA_RULES.photo.minLongSide;
        expect(await longSide(file), file).toBeGreaterThanOrEqual(min);
      }
      if (complex.facade)
        expect(await longSide(complex.facade), complex.facade).toBeGreaterThanOrEqual(
          MEDIA_RULES.facade.minLongSide,
        );
    }
  });

  it("тексты в пределах кабинета, без контактов и скидок, на двух языках", () => {
    for (const developer of content.developers) {
      for (const text of texts(developer.about)) {
        expect(text.length, developer.slug).toBeLessThanOrEqual(DEVELOPER_LIMITS.aboutMax);
        expect(containsContact(text), text).toBe(false);
        expect(mentionsDiscount(text), text).toBe(false);
      }
      for (const project of developer.pastProjects ?? []) {
        for (const text of texts(project.name)) expect(text.length, text).toBeLessThanOrEqual(80);
      }
    }
    for (const complex of content.complexes) {
      for (const text of texts(complex.address)) {
        expect(text.length, text).toBeLessThanOrEqual(COMPLEX_LIMITS.addressMax);
        expect(containsContact(text), text).toBe(false);
      }
      for (const text of texts(complex.landmark)) {
        expect(text.length, text).toBeLessThanOrEqual(COMPLEX_LIMITS.landmarkMax);
        expect(containsContact(text), text).toBe(false);
      }
      for (const [topic, value] of Object.entries(complex.details ?? {})) {
        expect(value.ru.trim().length, `${complex.slug} ${topic}`).toBeGreaterThan(0);
        expect(value.uz.trim().length, `${complex.slug} ${topic}`).toBeGreaterThan(0);
        for (const text of texts(value)) {
          expect(text.length, topic).toBeLessThanOrEqual(DETAIL_LIMITS.textMax);
          expect(containsContact(text), text).toBe(false);
          expect(mentionsDiscount(text), text).toBe(false);
        }
      }
    }
  });

  it("основное — в пределах базы: точка в Ферганской области, места рядом, потолки", () => {
    for (const complex of content.complexes) {
      if (complex.point) {
        expect(complex.point[0], complex.slug).toBeGreaterThan(39.5);
        expect(complex.point[0], complex.slug).toBeLessThan(41);
        expect(complex.point[1], complex.slug).toBeGreaterThan(70);
        expect(complex.point[1], complex.slug).toBeLessThan(73);
      }
      if (complex.ceilingHeight !== undefined) {
        expect(complex.ceilingHeight).toBeGreaterThanOrEqual(COMPLEX_LIMITS.ceilingMin);
        expect(complex.ceilingHeight).toBeLessThanOrEqual(COMPLEX_LIMITS.ceilingMax);
      }
      const nearby = complex.nearby ?? [];
      expect(nearby.length, complex.slug).toBeLessThanOrEqual(NEARBY_LIMITS.places);
      for (const place of nearby) {
        expect(NEARBY_KINDS as readonly string[], place.kind).toContain(place.kind);
        expect(Number.isInteger(place.minutes) && place.minutes >= 1, place.name.ru).toBe(true);
        for (const text of texts(place.name)) {
          expect(text.length, text).toBeLessThanOrEqual(NEARBY_LIMITS.nameMax);
          expect(containsContact(text), text).toBe(false);
        }
      }
    }
  });

  it("блоки: срок — квартал, название в пределах, построено не выше этажности, пункты цены без контактов", () => {
    for (const complex of content.complexes) {
      expect(complex.blocks.length, complex.slug).toBeLessThanOrEqual(BLOCK_LIMITS.maxRows);
      expect(new Set(complex.blocks.map((block) => block.name)).size, complex.slug).toBe(
        complex.blocks.length,
      );
      for (const block of complex.blocks) {
        expect(block.name.length, block.name).toBeLessThanOrEqual(BLOCK_LIMITS.nameMax);
        if (block.floorsBuilt !== undefined)
          expect(block.floorsBuilt, block.name).toBeLessThanOrEqual(block.floorsTotal);
        if (block.deadline) expect(block.deadline[1]).toBeGreaterThanOrEqual(1);
        if (block.deadline) expect(block.deadline[1]).toBeLessThanOrEqual(4);
        expect((block.includes ?? []).length).toBeLessThanOrEqual(BLOCK_LIMITS.includesMax);
        for (const include of block.includes ?? []) {
          for (const text of texts(include.item)) {
            expect(text.length, text).toBeLessThanOrEqual(BLOCK_LIMITS.includeItemMax);
            expect(containsContact(text), text).toBe(false);
          }
        }
      }
    }
  });

  it("квартиры: планировки и чертежи на месте, цены и номера сходятся", async () => {
    for (const complex of content.complexes) {
      const file = unitsOf(complex);
      if (!file) continue;
      for (const [key, layout] of Object.entries(file.layouts)) {
        expect(layout.rooms, key).toBeGreaterThanOrEqual(0);
        expect(layout.area, key).toBeGreaterThan(0);
        if (layout.drawing) {
          expect(existsSync(path.join(ZHK_DIR, layout.drawing)), layout.drawing).toBe(true);
          expect(await longSide(layout.drawing), layout.drawing).toBeGreaterThanOrEqual(
            MEDIA_RULES.drawing.minLongSide,
          );
        }
      }
      for (const [name, block] of Object.entries(file.blocks)) {
        expect(
          complex.blocks.some((item) => item.name === name),
          `${complex.slug} ${name}`,
        ).toBe(true);
        const rows = unitRows(block);
        expect(new Set(rows.map((row) => row.number)).size, name).toBe(rows.length);
        expect(new Set(rows.map((row) => `${row.floor}-${row.position}`)).size, name).toBe(
          rows.length,
        );
        for (const row of rows) {
          if (row.layout) expect(file.layouts[row.layout], `${name} ${row.number}`).toBeDefined();
          expect(row.price ?? row.pricePerM2 ?? 0, `${name} ${row.number}`).toBeGreaterThan(0);
          expect(row.number).toMatch(/^[0-9A-Za-zА-Яа-я/-]{1,10}$/);
        }
      }
    }
  });

  it("цены Sayilgoh: снимки шахматки прочитаны без ошибок — у стояка чем выше этаж, тем дешевле", () => {
    const file = unitsOf(content.complexes.find((complex) => complex.slug === "sayilgoh")!)!;
    for (const [name, block] of Object.entries(file.blocks)) {
      const byRiser = new Map<number, { floor: number; price: number }[]>();
      for (const row of unitRows(block)) {
        if (row.layout?.endsWith("136") || row.layout?.endsWith("175") || row.floor > 10) continue;
        const list = byRiser.get(row.position) ?? [];
        list.push({ floor: row.floor, price: row.price! });
        byRiser.set(row.position, list);
      }
      for (const [riser, list] of byRiser) {
        const sorted = [...list].sort((a, b) => a.floor - b.floor);
        for (let index = 1; index < sorted.length; index += 1) {
          expect(
            sorted[index]!.price,
            `${name} стояк ${riser}, этаж ${sorted[index]!.floor}`,
          ).toBeLessThan(sorted[index - 1]!.price);
        }
      }
    }
  });

  it("цены Sayilgoh на сайте — из чек-листа: 3-й этаж 9 500 000, выше на 100 000 дешевле, 164 квартиры", () => {
    const file = unitsOf(content.complexes.find((complex) => complex.slug === "sayilgoh")!)!;
    const rows = Object.keys(file.blocks).flatMap((name) => siteUnitRows(file, name));
    expect(rows).toHaveLength(164);
    expect(rows.filter((row) => row.status === "free")).toHaveLength(106);
    for (const row of rows) {
      expect(row.price, row.number).toBeNull();
      expect(row.pricePerM2, `этаж ${row.floor}`).toBe(9_500_000 - (row.floor - 3) * 100_000);
    }
  });

  it("свободные квартиры совпадают с чек-листом: Chinor — 31, Shodlik — 15", () => {
    const free = (slug: string) => {
      const file = unitsOf(content.complexes.find((complex) => complex.slug === slug)!)!;
      return Object.values(file.blocks)
        .flatMap(unitRows)
        .filter((row) => row.status === "free").length;
    };
    expect(free("chinor-residence")).toBe(31);
    expect(free("shodlik")).toBe(15);
  });

  it("ЖК к публикации готов: рендеры, срок, планировка с чертежом и ценой, застройщик с текстом и логотипом", () => {
    for (const complex of content.complexes.filter((item) => item.publish)) {
      expect(complex.photos.length, complex.slug).toBeGreaterThanOrEqual(5);
      expect(complex.address, complex.slug).toBeDefined();
      expect(complex.point, complex.slug).toBeDefined();
      expect(
        complex.blocks.some((block) => block.deadline),
        complex.slug,
      ).toBe(true);
      const file = unitsOf(complex)!;
      const free = complex.blocks.flatMap((block) =>
        file.blocks[block.name]
          ? unitRows(file.blocks[block.name]!).filter((row) => row.status === "free")
          : [],
      );
      expect(
        free.some((row) => row.layout && file.layouts[row.layout]?.drawing),
        complex.slug,
      ).toBe(true);
      const developer = content.developers.find((item) => item.slug === complex.developer)!;
      expect(developer.publish && developer.about && developer.logo, developer.slug).toBeTruthy();
    }
    for (const complex of content.complexes) {
      const file = unitsOf(complex);
      if (!file) continue;
      for (const block of complex.blocks)
        expect(Array.isArray(blockLayoutKeys(file, block.name))).toBe(true);
    }
  });

  it("отчёт хода строительства: 3–15 кадров, комментарий до 300 знаков", () => {
    for (const complex of content.complexes) {
      for (const report of complex.progress ?? []) {
        expect(report.photos.length).toBeGreaterThanOrEqual(3);
        expect(report.photos.length).toBeLessThanOrEqual(15);
        for (const file of report.photos)
          expect(existsSync(path.join(ZHK_DIR, file)), file).toBe(true);
        for (const text of texts(report.comment)) {
          expect(text.length, text).toBeLessThanOrEqual(300);
          expect(containsContact(text), text).toBe(false);
        }
        expect(complex.blocks.some((block) => block.name === report.block)).toBe(true);
      }
    }
  });
});
