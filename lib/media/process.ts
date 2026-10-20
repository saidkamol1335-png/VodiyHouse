import { blurDataUrl, decodeImage, drawDownscaled, encodeCanvas, releaseCanvas } from "./canvas";
import { downscaleSteps, fitWithin } from "./fit";
import type { StoredImageType } from "./path";
import {
  JPEG_QUALITY,
  MEDIA_KIND_RULES,
  checkResolution,
  checkSourceFile,
  checkStoredSize,
  type ImageSize,
  type MediaIssue,
  type MediaKind,
} from "./rules";

// Подготовка фото в браузере перед загрузкой (решение фазы 1, в. 2): проверка типа, веса и
// разрешения → уменьшение до ≤ 3200 px → новый файл без EXIF → blur-заглушка.

export type ProcessedImage = {
  blob: Blob;
  type: StoredImageType;
  width: number;
  height: number;
  /** data URL для placeholder="blur" у next/image. */
  blur: string;
  source: ImageSize & { bytes: number };
};

export type ProcessResult = { ok: true; image: ProcessedImage } | { ok: false; issue: MediaIssue };

const fail = (issue: MediaIssue): ProcessResult => ({ ok: false, issue });

export async function processImage(file: File, kind: MediaKind): Promise<ProcessResult> {
  const sourceIssue = checkSourceFile(file);
  if (sourceIssue) return fail(sourceIssue);

  const decoded = await decodeImage(file);
  if (!decoded) return fail({ code: "decodeFailed" });
  try {
    const resolutionIssue = checkResolution(decoded.size, kind);
    if (resolutionIssue) return fail(resolutionIssue);

    const { maxLongSide, output } = MEDIA_KIND_RULES[kind];
    const target = fitWithin(decoded.size, maxLongSide);
    const steps = downscaleSteps(decoded.size, target);
    const canvas = drawDownscaled(decoded.source, steps, output === "image/jpeg");
    if (!canvas) return fail({ code: "processingFailed" });

    const blob = await encodeCanvas(canvas, output, JPEG_QUALITY);
    const blur = blurDataUrl(canvas, output);
    releaseCanvas(canvas);
    if (!blob || blob.type !== output || !blur) return fail({ code: "processingFailed" });

    const storedIssue = checkStoredSize(blob.size);
    if (storedIssue) return fail(storedIssue);
    const source = { ...decoded.size, bytes: file.size };
    return { ok: true, image: { blob, type: output, ...target, blur, source } };
  } finally {
    decoded.release();
  }
}
