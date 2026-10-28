// Кадры, ролики и этапы первого экрана «Чертёж → стройка» (блок H). Файлы кэшируются на год
// (netlify.toml, immutable), поэтому новый ролик — Higgsfield — кладётся в новую папку версии:
// здесь меняются VERSION, число и размер кадров, границы этапов; компонент не меняется.
// v1 — CGI-рендер из архива исполнителя (28.10.2026): 208 кадров 1280×720, 24 к/с, 8,7 с.

export const HERO_ASSET_VERSION = "v1";
export const HERO_ASSET_BASE = `/hero/blueprint/${HERO_ASSET_VERSION}`;
export const FRAME_COUNT = 208;
export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;
/** Где по горизонтали стоят башни (0…1): узкий экран обрезает кадр так, чтобы они остались в нём. */
export const FOCUS_X = 0.6;

export const frameSrc = (index: number): string =>
  `${HERO_ASSET_BASE}/frames/${String(index + 1).padStart(4, "0")}.webp`;

export const HERO_ASSETS = {
  /** Последний кадр — «Дом сдан»: первая картинка страницы во всех режимах (LCP; телефону — портретный). */
  posterEnd: `${HERO_ASSET_BASE}/poster-end.webp`,
  posterEndMobile: `${HERO_ASSET_BASE}/poster-end-mobile.webp`,
  video: `${HERO_ASSET_BASE}/hero-desktop.mp4`,
  videoMobile: `${HERO_ASSET_BASE}/hero-mobile.mp4`,
} as const;

export const STAGE_KEYS = ["site", "pit", "foundation", "frame", "facade", "roof", "yard", "done"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export type BuildStage = {
  key: StageKey;
  /** Первый кадр этапа (с нуля). */
  from: number;
  /** Отметка высоты для подписи внизу, м — условная, как на площадке. */
  elevation: number;
};

/** Границы — по ролику v1. */
export const BUILD_STAGES: readonly BuildStage[] = [
  { key: "site", from: 0, elevation: 0 },
  { key: "pit", from: 14, elevation: -6.5 },
  { key: "foundation", from: 35, elevation: -3.2 },
  { key: "frame", from: 50, elevation: 28.4 },
  { key: "facade", from: 110, elevation: 51 },
  { key: "roof", from: 135, elevation: 54.6 },
  { key: "yard", from: 150, elevation: 54.6 },
  { key: "done", from: 168, elevation: 54.6 },
];
export const STAGE_COUNT = BUILD_STAGES.length;

/** В full секция выше экрана на всю ленту: 360vh прокрутки — около 15 px на кадр. */
export const HERO_SCRUB_VH = 360;
/** Доли прокрутки: синька держится до 6 %, стройка идёт 6–92 %, финал — с 88 %. */
export const BUILD_START = 0.06;
export const BUILD_END = 0.92;
export const BLUEPRINT_FADE: readonly [number, number] = [0.015, 0.1];
export const INTRO_FADE: readonly [number, number] = [0.03, 0.16];
export const FINALE_FADE: readonly [number, number] = [0.9, 0.98];
export const PAST_INTRO_AT = 0.16;
export const FINALE_AT = 0.88;

export const clamp01 = (value: number): number => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/** Доля отрезка [from, to], в которой находится value: 0 до него, 1 после. */
export const span = (value: number, from: number, to: number): number => clamp01((value - from) / (to - from));

/** Кадр по доле ролика 0…1 (lite — по времени видео). */
export function frameOfProgress(progress: number): number {
  return clamp01(progress) * (FRAME_COUNT - 1);
}

export function stageOfFrame(frame: number): number {
  let stage = 0;
  BUILD_STAGES.forEach((item, index) => {
    if (frame >= item.from) stage = index;
  });
  return stage;
}

/** Отметка высоты между этапами — плавно, как нивелир на площадке: «+28,400», «−6,500», «±0,000». */
export function elevationAt(frame: number): string {
  const index = stageOfFrame(frame);
  const from = BUILD_STAGES[index]!;
  const to = BUILD_STAGES[Math.min(index + 1, STAGE_COUNT - 1)]!;
  const share = to === from ? 0 : clamp01((frame - from.from) / Math.max(1, to.from - from.from));
  const value = from.elevation + (to.elevation - from.elevation) * share;
  const sign = value > 0.0005 ? "+" : value < -0.0005 ? "−" : "±";
  return `${sign}${Math.abs(value).toFixed(3).replace(".", ",")}`;
}

/** «01», «08» — номера этапов в подписях. */
export const padIndex = (value: number, width = 2): string => String(value).padStart(width, "0");
