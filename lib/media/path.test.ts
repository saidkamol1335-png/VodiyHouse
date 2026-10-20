import { describe, expect, it } from "vitest";
import { MEDIA_PATH_PATTERN, mediaFolder, mediaPath, ownerTypeOf } from "./path";
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

  it("логотип и фон — у застройщика, остальное — у ЖК", () => {
    const owners = Object.fromEntries(MEDIA_KINDS.map((kind) => [kind, ownerTypeOf(kind)]));
    expect(owners).toEqual({
      photo: "complex",
      drawing: "complex",
      facade: "complex",
      logo: "developer",
      cover: "developer",
    });
  });
});
