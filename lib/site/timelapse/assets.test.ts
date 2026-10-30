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
const frameFiles = TIMELAPSE_FRAMES.sets.flatMap((set) =>
  Array.from({ length: TIMELAPSE_FRAMES.count }, (_, index) => timelapseFrameSrc(set, index)),
);

describe("ролик стройки: файлы", () => {
  it("телефону — 9:16, остальным — 1080p; WebM, где он играет, иначе MP4", () => {
    expect(timelapseVideoSrc({ phone: true, webm: true })).toBe(
      "/hero/timelapse/v3/hero-portrait.webm",
    );
    expect(timelapseVideoSrc({ phone: true, webm: false })).toBe(
      "/hero/timelapse/v3/hero-portrait.mp4",
    );
    expect(timelapseVideoSrc({ phone: false, webm: true })).toBe(
      "/hero/timelapse/v3/hero-1080.webm",
    );
    expect(timelapseVideoSrc({ phone: false, webm: false })).toBe(
      "/hero/timelapse/v3/hero-1080.mp4",
    );
  });

  it("два набора кадров, в каждом кадры пронумерованы с 0001 по порядку", () => {
    expect(TIMELAPSE_FRAMES.sets).toEqual([1920, 1280]);
    expect(timelapseFrameSrc(1920, 0)).toBe("/hero/timelapse/v3/frames-1920/0001.webp");
    expect(timelapseFrameSrc(1280, TIMELAPSE_FRAMES.count - 1)).toBe(
      "/hero/timelapse/v3/frames-1280/0121.webp",
    );
  });

  it("каждый ролик, постер и кадр ленты лежит в public, лишних кадров нет", () => {
    const missing = [...posterFiles, ...videoFiles, ...frameFiles].filter(
      (url) => !existsSync(path.join("public", url)),
    );
    expect(missing).toEqual([]);
    for (const set of TIMELAPSE_FRAMES.sets) {
      const extra = timelapseFrameSrc(set, TIMELAPSE_FRAMES.count);
      expect(existsSync(path.join("public", extra))).toBe(false);
    }
  });
});

describe("ролик стройки: экономия трафика", () => {
  it("Save-Data — только постер; скорость сети ролик не отключает", () => {
    expect(skipsVideo({ connection: { saveData: true } })).toBe(true);
    expect(skipsVideo({ connection: { saveData: false } })).toBe(false);
    const slow = { saveData: false, effectiveType: "slow-2g" };
    expect(skipsVideo({ connection: slow })).toBe(false);
    expect(skipsVideo({})).toBe(false);
  });
});
