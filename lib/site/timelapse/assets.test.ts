import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skipsVideo } from "./useTimelapseVideo";
import { TIMELAPSE_POSTER, timelapseVideoSrc } from "./assets";

// Файлы /hero/* кэшируются на год (immutable): опечатка в имени не исправится у вернувшегося
// посетителя, поэтому каждый путь сверяется с public/ здесь, а не на тестовом деплое.

const posterFiles = Object.values(TIMELAPSE_POSTER).flatMap((value) =>
  value.split(", ").map((entry) => entry.split(" ")[0]!),
);
const videoFiles = [true, false].flatMap((phone) =>
  [true, false].map((webm) => timelapseVideoSrc({ phone, webm })),
);

describe("ролик стройки: файлы", () => {
  it("телефону — 9:16, остальным — 1080p; WebM, где он играет, иначе MP4", () => {
    expect(timelapseVideoSrc({ phone: true, webm: true })).toBe(
      "/hero/timelapse/v1/hero-portrait.webm",
    );
    expect(timelapseVideoSrc({ phone: true, webm: false })).toBe(
      "/hero/timelapse/v1/hero-portrait.mp4",
    );
    expect(timelapseVideoSrc({ phone: false, webm: true })).toBe(
      "/hero/timelapse/v1/hero-1080.webm",
    );
    expect(timelapseVideoSrc({ phone: false, webm: false })).toBe(
      "/hero/timelapse/v1/hero-1080.mp4",
    );
  });

  it("каждый ролик и постер лежит в public", () => {
    const missing = [...posterFiles, ...videoFiles].filter(
      (url) => !existsSync(path.join("public", url)),
    );
    expect(missing).toEqual([]);
  });
});

describe("ролик стройки: экономия трафика", () => {
  it("Save-Data, 2G и 3G — только постер; 4G и без подсказок — ролик", () => {
    expect(skipsVideo({ connection: { saveData: true, effectiveType: "4g" } })).toBe(true);
    expect(skipsVideo({ connection: { effectiveType: "3g" } })).toBe(true);
    expect(skipsVideo({ connection: { effectiveType: "slow-2g" } })).toBe(true);
    expect(skipsVideo({ connection: { saveData: false, effectiveType: "4g" } })).toBe(false);
    expect(skipsVideo({})).toBe(false);
  });
});
