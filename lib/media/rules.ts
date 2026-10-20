// Правила загрузки фото (PLAN 3а «Защита от дешёвого вида», решение фазы 1, в. 2): браузер
// отклоняет слабые и тяжёлые исходники и уменьшает остальное до одного файла ≤ 3200 px.
// Размеры и AVIF/WebP для сайта делает next/image по запросу.

/** Виды файлов — как enum media_kind в базе. Фото ЖК, чертёж, фасад; логотип и фон застройщика. */
export const MEDIA_KINDS = ["photo", "drawing", "facade", "logo", "cover"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export type ImageSize = { width: number; height: number };

const MEGABYTE = 1024 * 1024;

export const MEDIA_LIMITS = {
  /** Исходник тяжелее — отклоняется до декодирования (PLAN 3а). */
  maxSourceBytes: 25 * MEGABYTE,
  /** Лимит бакета media: уменьшенный файл тяжелее не примет и сам Storage. */
  maxStoredBytes: 15 * MEGABYTE,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"],
  /** Обложка ЖК — первое фото галереи, ей нужно столько же, сколько фону застройщика. */
  complexCoverMinLongSide: 2400,
} as const;

type KindRule = {
  /** Меньше по длинной стороне — отклоняется (PLAN 3а). */
  minLongSide: number;
  /** Больше — уменьшается в браузере. */
  maxLongSide: number;
  /** Логотипу нужна прозрачность — PNG; у фото и чертежей её нет — JPEG легче. */
  output: "image/jpeg" | "image/png";
};

// Логотип на сайте не шире пары сотен пикселей: 400 px хватает для экранов ×2, 1600 — с запасом.
export const MEDIA_KIND_RULES: Record<MediaKind, KindRule> = {
  photo: { minLongSide: 1600, maxLongSide: 3200, output: "image/jpeg" },
  cover: { minLongSide: 2400, maxLongSide: 3200, output: "image/jpeg" },
  facade: { minLongSide: 2400, maxLongSide: 3200, output: "image/jpeg" },
  drawing: { minLongSide: 1200, maxLongSide: 3200, output: "image/jpeg" },
  logo: { minLongSide: 400, maxLongSide: 1600, output: "image/png" },
};

export const JPEG_QUALITY = 0.9;

export type MediaIssue =
  | { code: "unsupportedType" }
  | { code: "sourceTooLarge"; maxMegabytes: number }
  | { code: "decodeFailed" }
  | { code: "resolutionTooLow"; longSide: number; minLongSide: number }
  /** Холст не отдал файл — обычно не хватило памяти телефона. */
  | { code: "processingFailed" }
  | { code: "storedTooLarge"; maxMegabytes: number };

export const longSideOf = ({ width, height }: ImageSize) => Math.max(width, height);

/** Тип и вес — до чтения файла: 30-мегабайтный рендер не декодируем зря. */
export function checkSourceFile(file: { type: string; size: number }): MediaIssue | null {
  if (!(MEDIA_LIMITS.acceptedTypes as readonly string[]).includes(file.type)) {
    return { code: "unsupportedType" };
  }
  if (file.size > MEDIA_LIMITS.maxSourceBytes) {
    return { code: "sourceTooLarge", maxMegabytes: MEDIA_LIMITS.maxSourceBytes / MEGABYTE };
  }
  return null;
}

/** Разрешение — после декодирования, с учётом поворота из EXIF. */
export function checkResolution(size: ImageSize, kind: MediaKind): MediaIssue | null {
  const { minLongSide } = MEDIA_KIND_RULES[kind];
  const longSide = longSideOf(size);
  return longSide < minLongSide ? { code: "resolutionTooLow", longSide, minLongSide } : null;
}

export function checkStoredSize(bytes: number): MediaIssue | null {
  return bytes > MEDIA_LIMITS.maxStoredBytes
    ? { code: "storedTooLarge", maxMegabytes: MEDIA_LIMITS.maxStoredBytes / MEGABYTE }
    : null;
}

/** Фото галереи от 1600 px принимается, но первым (обложкой) встать может только от 2400 px. */
export function canBeComplexCover(size: ImageSize): boolean {
  return longSideOf(size) >= MEDIA_LIMITS.complexCoverMinLongSide;
}
