import { downscaleSteps, fitWithin } from "./fit";
import type { StoredImageType } from "./path";
import type { ImageSize } from "./rules";

// Холст — только в браузере (кабинет, вкладка «Фото»). Перекодирование через холст само
// убирает EXIF и другие метаданные: в новый файл попадают только пиксели.

export type DecodedImage = {
  source: CanvasImageSource;
  /** Размер уже с учётом поворота из EXIF. */
  size: ImageSize;
  release: () => void;
};

/** Сторона blur-заглушки: next/image растягивает и размывает её сам, ~0,5 КБ в базе. */
export const BLUR_LONG_SIDE = 12;

const BLUR_QUALITY = 0.7;

export async function decodeImage(file: Blob): Promise<DecodedImage | null> {
  try {
    // from-image — повернуть по EXIF: снимок с телефона иначе ляжет на бок.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const size = { width: bitmap.width, height: bitmap.height };
    return { source: bitmap, size, release: () => bitmap.close() };
  } catch {
    return decodeWithImageElement(file);
  }
}

// Запасной путь для браузеров, где createImageBitmap не читает файл: <img> тоже учитывает EXIF.
async function decodeWithImageElement(file: Blob): Promise<DecodedImage | null> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    const size = { width: image.naturalWidth, height: image.naturalHeight };
    return { source: image, size, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
}

/** Освободить память холста сразу: iOS Safari держит её до сборки мусора и падает на больших фото. */
export function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/** Рисует источник по шагам уменьшения; opaque — подложить белый (у JPEG нет прозрачности). */
export function drawDownscaled(
  source: CanvasImageSource,
  steps: readonly ImageSize[],
  opaque: boolean,
): HTMLCanvasElement | null {
  let current: CanvasImageSource = source;
  let canvas: HTMLCanvasElement | null = null;
  for (const step of steps) {
    const next = document.createElement("canvas");
    next.width = step.width;
    next.height = step.height;
    const context = next.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    if (opaque) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, step.width, step.height);
    }
    context.drawImage(current, 0, 0, step.width, step.height);
    if (canvas) releaseCanvas(canvas);
    canvas = next;
    current = next;
  }
  return canvas;
}

export function encodeCanvas(
  canvas: HTMLCanvasElement,
  type: StoredImageType,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Крошечная копия для placeholder="blur" у next/image — data URL того же типа, что и фото. */
export function blurDataUrl(canvas: HTMLCanvasElement, type: StoredImageType): string | null {
  const size = { width: canvas.width, height: canvas.height };
  const target = fitWithin(size, BLUR_LONG_SIDE);
  const tiny = drawDownscaled(canvas, downscaleSteps(size, target), type === "image/jpeg");
  if (!tiny) return null;
  const url = tiny.toDataURL(type, BLUR_QUALITY);
  releaseCanvas(tiny);
  return url;
}
