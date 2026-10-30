import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { skipsVideo } from "./useTimelapseVideo";
import { TIMELAPSE_FRAMES, TIMELAPSE_POSTER, timelapseFrameSrc, timelapseVideoSrc } from "./assets";

// Файлы /hero/* кэшируются на год (immutable): опечатка в имени не исправится у вернувшегося
// посетителя, поэтому каждый путь сверяется с public/ здесь, а не на тестовом деплое.

const posterFiles = Object.values(TIMELAPSE_POSTER).flatMap((value) =>
  value.split(", ").map((entry) => entry.split(" ")[0]!),
);
const videoFiles = [true, false].flatMap((phone) =>
  [true, false].map((webm) => timelapseVideoSrc({ phone, webm })),
);
const frameFiles = Array.from({ length: TIMELAPSE_FRAMES.count }, (_, index) =>
  timelapseFrameSrc(index),
);

describe("ролик стройки: файлы", () => {
  it("телефону — 9:16, остальным — 1080p; WebM, где он играет, иначе MP4", () => {
    expect(timelapseVideoSrc({ phone: true, webm: true })).toBe(
      "/hero/timelapse/v2/hero-portrait.webm",
    );
    expect(timelapseVideoSrc({ phone: true, webm: false })).toBe(
      "/hero/timelapse/v2/hero-portrait.mp4",
    );
    expect(timelapseVideoSrc({ phone: false, webm: true })).toBe(
      "/hero/timelapse/v2/hero-1080.webm",
    );
    expect(timelapseVideoSrc({ phone: false, webm: false })).toBe(
      "/hero/timelapse/v2/hero-1080.mp4",
    );
  });

  it("кадры ленты пронумерованы с 0001 по порядку", () => {
    expect(timelapseFrameSrc(0)).toBe("/hero/timelapse/v2/frames/0001.webp");
    expect(timelapseFrameSrc(TIMELAPSE_FRAMES.count - 1)).toBe(
      "/hero/timelapse/v2/frames/0121.webp",
    );
  });

  it("каждый ролик, постер и кадр ленты лежит в public, лишних кадров нет", () => {
    const missing = [...posterFiles, ...videoFiles, ...frameFiles].filter(
      (url) => !existsSync(path.join("public", url)),
    );
    expect(missing).toEqual([]);
    expect(existsSync(path.join("public", timelapseFrameSrc(TIMELAPSE_FRAMES.count)))).toBe(false);
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
