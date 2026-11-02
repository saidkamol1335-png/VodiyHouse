import { describe, expect, it } from "vitest";
import { hasExif } from "./metadata";

const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const segment = (marker: number, payload: number[]) => {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
};

const SOI = [0xff, 0xd8];
const APP0_JFIF = segment(0xe0, [...ascii("JFIF"), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const APP1_EXIF = segment(0xe1, [...ascii("Exif"), 0, 0, ...ascii("MM"), 0, 0x2a, 0, 0, 0, 8]);
const APP1_XMP = segment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x/>"));
const SCAN = [0xff, 0xda, 0, 2, 0x12, 0x34, 0xff, 0xd9];

const chunk = (type: string, data: number[] = []) => [
  0,
  0,
  data.length >> 8,
  data.length & 0xff,
  ...ascii(type),
  ...data,
  0,
  0,
  0,
  0,
];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = chunk(
  "IHDR",
  Array.from({ length: 13 }, () => 0),
);

const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

describe("EXIF в файле", () => {
  it("JPEG: находит APP1 Exif и после JFIF", () => {
    expect(hasExif(bytes(SOI, APP1_EXIF, SCAN))).toBe(true);
    expect(hasExif(bytes(SOI, APP0_JFIF, APP1_EXIF, SCAN))).toBe(true);
  });

  it("JPEG: без Exif, только XMP или Exif-подобные байты в пикселях — нет", () => {
    expect(hasExif(bytes(SOI, APP0_JFIF, SCAN))).toBe(false);
    expect(hasExif(bytes(SOI, APP1_XMP, SCAN))).toBe(false);
    expect(hasExif(bytes(SOI, APP0_JFIF, SCAN, APP1_EXIF))).toBe(false);
  });

  it("PNG: чанк eXIf до IEND", () => {
    expect(hasExif(bytes(PNG_SIGNATURE, IHDR, chunk("eXIf", [1, 2]), chunk("IEND")))).toBe(true);
    expect(hasExif(bytes(PNG_SIGNATURE, IHDR, chunk("IDAT", [1]), chunk("IEND")))).toBe(false);
  });

  it("не картинка и обрезанный файл — нет", () => {
    expect(hasExif(new Uint8Array(ascii("GIF89a")))).toBe(false);
    expect(hasExif(bytes(SOI, [0xff, 0xe1, 0x00]))).toBe(false);
  });
});
