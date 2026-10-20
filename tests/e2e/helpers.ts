import type { Page } from "@playwright/test";

/** Ошибки консоли и необработанные исключения страницы. «Готово» — только при пустом списке. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

export const PUBLIC_PAGES = ["/uz", "/ru"] as const;

// Картинки для загрузки рисуются прямо в браузере — фикстуры в git не нужны.
export type ImageSpec = {
  width: number;
  height: number;
  type: "image/jpeg" | "image/png" | "image/gif";
  /** Вставить EXIF с ориентацией (6 — повернуть на 90° по часовой, как у снимка с телефона). */
  exifOrientation?: number;
};

export async function makeImage(page: Page, spec: ImageSpec): Promise<Buffer> {
  const base64 = await page.evaluate(async ({ width, height, type, exifOrientation }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#3a8f63";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "#e0402f";
    context.fillRect(0, 0, width / 4, height / 4);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), type, 0.92),
    );
    let bytes = new Uint8Array(await blob.arrayBuffer());
    if (exifOrientation) {
      // APP1 "Exif": TIFF big-endian, одна запись Orientation (0x0112, SHORT).
      const app1 = [
        0xff,
        0xe1,
        0x00,
        0x22,
        0x45,
        0x78,
        0x69,
        0x66,
        0x00,
        0x00,
        0x4d,
        0x4d,
        0x00,
        0x2a,
        0x00,
        0x00,
        0x00,
        0x08,
        0x00,
        0x01,
        0x01,
        0x12,
        0x00,
        0x03,
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        exifOrientation,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
      ];
      bytes = new Uint8Array([...bytes.subarray(0, 2), ...app1, ...bytes.subarray(2)]);
    }
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }, spec);
  return Buffer.from(base64, "base64");
}

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif" } as const;

/** Файл для setInputFiles: картинка нужного размера и типа. */
export async function imageFile(page: Page, spec: ImageSpec) {
  return {
    name: `render.${EXTENSIONS[spec.type]}`,
    mimeType: spec.type,
    buffer: await makeImage(page, spec),
  };
}
