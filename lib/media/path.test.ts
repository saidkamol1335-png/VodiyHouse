import { describe, expect, it } from "vitest";
import {
  isOwnMediaPath,
  MEDIA_PATH_PATTERN,
  mediaFolder,
  mediaPath,
  mediaPublicUrl,
  ownerTypeOf,
  PROGRESS_VIDEO_PATH_PATTERN,
  progressVideoPath,
  progressVideoPublicUrl,
} from "./path";
import { MEDIA_KINDS } from "./rules";

const COMPLEX_ID = "8a6e0804-2bd0-4672-b79d-d97027f9071a";
const FILE_ID = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";

describe("путь файла в бакете", () => {
  it("фото ЖК — JPEG в папке ЖК, логотип — PNG в папке застройщика", () => {
    expect(mediaPath({ type: "complex", id: COMPLEX_ID }, "image/jpeg", FILE_ID)).toBe(
      `complexes/${COMPLEX_ID}/${FILE_ID}.jpg`,
    );
    expect(mediaPath({ type: "developer", id: COMPLEX_ID }, "image/png", FILE_ID)).toBe(
      `developers/${COMPLEX_ID}/${FILE_ID}.png`,
    );
  });

  it("новое имя каждый раз и всегда по шаблону политики Storage", () => {
    const owner = { type: "complex", id: COMPLEX_ID } as const;
    const first = mediaPath(owner, "image/jpeg");
    expect(first).toMatch(MEDIA_PATH_PATTERN);
    expect(first).not.toBe(mediaPath(owner, "image/jpeg"));
    expect(first.startsWith(`${mediaFolder(owner)}/`)).toBe(true);
  });

  it("обложка витрины — в папке спецпредложения, подборки или рекламы (3.16а)", () => {
    expect(mediaPath({ type: "special", id: COMPLEX_ID }, "image/jpeg", FILE_ID)).toBe(
      `specials/${COMPLEX_ID}/${FILE_ID}.jpg`,
    );
    expect(mediaPath({ type: "collection", id: COMPLEX_ID }, "image/jpeg", FILE_ID)).toBe(
      `collections/${COMPLEX_ID}/${FILE_ID}.jpg`,
    );
    expect(mediaPath({ type: "ad", id: COMPLEX_ID }, "image/jpeg", FILE_ID)).toMatch(
      MEDIA_PATH_PATTERN,
    );
  });

  it("логотип и фон — у застройщика, остальное — у ЖК", () => {
    const owners = Object.fromEntries(MEDIA_KINDS.map((kind) => [kind, ownerTypeOf(kind)]));
    expect(owners).toEqual({
      photo: "complex",
      drawing: "complex",
      facade: "complex",
      logo: "developer",
      cover: "developer",
      floor_plan: "complex",
    });
  });
});

describe("ссылка и проверка пути из формы", () => {
  const developer = { type: "developer", id: COMPLEX_ID } as const;

  it("публичная ссылка на файл бакета media", () => {
    expect(
      mediaPublicUrl("https://abcd.supabase.co/", `developers/${COMPLEX_ID}/${FILE_ID}.png`),
    ).toBe(
      `https://abcd.supabase.co/storage/v1/object/public/media/developers/${COMPLEX_ID}/${FILE_ID}.png`,
    );
  });

  it("только файл в папке своего владельца", () => {
    expect(isOwnMediaPath(developer, `developers/${COMPLEX_ID}/${FILE_ID}.png`)).toBe(true);
    expect(isOwnMediaPath(developer, `developers/${FILE_ID}/${FILE_ID}.png`)).toBe(false);
    expect(isOwnMediaPath(developer, `complexes/${COMPLEX_ID}/${FILE_ID}.jpg`)).toBe(false);
    expect(isOwnMediaPath(developer, `developers/${COMPLEX_ID}/../x.png`)).toBe(false);
  });
});

describe("видео отчётов (фаза 5)", () => {
  it("MP4 в папке ЖК, отдельный бакет; шаблон — как у политики Storage", () => {
    expect(progressVideoPath(COMPLEX_ID, FILE_ID)).toBe(`complexes/${COMPLEX_ID}/${FILE_ID}.mp4`);
    expect(progressVideoPath(COMPLEX_ID)).toMatch(PROGRESS_VIDEO_PATH_PATTERN);
    expect(progressVideoPublicUrl("https://x.supabase.co/", "complexes/a/b.mp4")).toBe(
      "https://x.supabase.co/storage/v1/object/public/progress-video/complexes/a/b.mp4",
    );
  });
});
