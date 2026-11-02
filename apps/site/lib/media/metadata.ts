// Есть ли в файле EXIF (геометка, модель камеры, дата съёмки). Нужно, чтобы проверить:
// после подготовки в браузере в бакет уходит файл без метаданных (PLAN 3а).

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_APP1 = 0xe1;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_END = 0xd9;

const startsWith = (bytes: Uint8Array, offset: number, prefix: readonly number[]) =>
  prefix.every((byte, index) => bytes[offset + index] === byte);

const readUint16 = (bytes: Uint8Array, offset: number) =>
  ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);

const readUint32 = (bytes: Uint8Array, offset: number) =>
  readUint16(bytes, offset) * 0x10000 + readUint16(bytes, offset + 2);

export function hasExif(bytes: Uint8Array): boolean {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return jpegHasExif(bytes);
  if (startsWith(bytes, 0, PNG_SIGNATURE)) return pngHasExif(bytes);
  return false;
}

// Метаданные JPEG — в сегментах до начала пикселей; EXIF — сегмент APP1 с заголовком "Exif".
function jpegHasExif(bytes: Uint8Array): boolean {
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === JPEG_START_OF_SCAN || marker === JPEG_END) return false;
    if (marker === JPEG_APP1 && startsWith(bytes, offset + 4, EXIF_HEADER)) return true;
    offset += 2 + readUint16(bytes, offset + 2);
  }
  return false;
}

// В PNG EXIF живёт в чанке eXIf: длина (4 байта), тип (4), данные, CRC (4).
function pngHasExif(bytes: Uint8Array): boolean {
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (type === "eXIf") return true;
    if (type === "IEND") return false;
    offset += 12 + readUint32(bytes, offset);
  }
  return false;
}
