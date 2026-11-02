import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Шрифт картинок превью (next/og): Manrope из assets/fonts/og — woff, satori не читает woff2.
// Подмножества — отдельные файлы: satori держит один файл на имя и вес, поэтому у каждого своё имя,
// а OG_FONT_FAMILY перечисляет их — глиф берётся из первого, где он есть (кириллица — из третьего).

const FONT_DIR = path.join(process.cwd(), "assets", "fonts", "og");
const SUBSETS = ["latin", "latin-ext", "cyrillic"] as const;
const WEIGHTS = [600, 800] as const;

const familyOf = (subset: (typeof SUBSETS)[number]) => `Manrope ${subset}`;
export const OG_FONT_FAMILY = SUBSETS.map((subset) => `"${familyOf(subset)}"`).join(", ");

export type OgFont = { name: string; data: ArrayBuffer; weight: (typeof WEIGHTS)[number]; style: "normal" };

async function readFont(subset: string, weight: number): Promise<ArrayBuffer> {
  const buffer = await readFile(path.join(FONT_DIR, `manrope-${subset}-${weight}-normal.woff`));
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function loadOgFonts(): Promise<OgFont[]> {
  const pairs = WEIGHTS.flatMap((weight) => SUBSETS.map((subset) => ({ weight, subset })));
  return Promise.all(
    pairs.map(async ({ weight, subset }) => ({
      name: familyOf(subset),
      data: await readFont(subset, weight),
      weight,
      style: "normal" as const,
    })),
  );
}
