/**
 * Иллюстрации к строкам «Документов ЖК» (03.11.2026): фактура по типу документа, не сканы — сканы
 * выдаёт менеджер по заявке. Фото Unsplash (лицензия Unsplash), список и авторы —
 * docs/assets/docs-hover/credits.md. Неизвестный тип (справочник правится в кабинете) — общий кадр.
 */
export const DOCUMENT_IMAGE_KEYS = [
  "land",
  "permit",
  "declaration",
  "expertise",
  "seismic",
  "commissioning",
  "generic",
] as const;

export type DocumentImageKey = (typeof DOCUMENT_IMAGE_KEYS)[number];

/** Версия папки: новые кадры — новая папка, кэш браузера на год не мешает. */
const BASE = "/docs-hover/v2";
/** Кадр 4:3, как у образца (256 × 192 на экране): 2× и 3×. */
const WIDTHS = [512, 768] as const;

export function documentImageKey(slug: string): DocumentImageKey {
  return (DOCUMENT_IMAGE_KEYS as readonly string[]).includes(slug) ? (slug as DocumentImageKey) : "generic";
}

export function documentImageSrcSet(key: DocumentImageKey, format: "avif" | "webp"): string {
  return WIDTHS.map((width) => `${BASE}/${key}-${width}.${format} ${width}w`).join(", ");
}

/** Запасной src для <img> внутри <picture>. */
export function documentImageSrc(key: DocumentImageKey): string {
  return `${BASE}/${key}-${WIDTHS[0]}.webp`;
}
