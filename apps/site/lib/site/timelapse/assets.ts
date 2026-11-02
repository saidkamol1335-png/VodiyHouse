// Ролик стройки ЖК v2 (Kling 3.0 Pro, 1080p, 15 с, 30.10.2026): полёт дрона — с высоты над пустым
// участком вниз и дугой к фасаду, пока идёт стройка; день → синий час. На первом экране главной в full —
// лента кадров по прокрутке (как в артефакте «Vodiy House Закат»), в lite — ролик один раз; в панели
// «Застройщикам» и фоном карточки «О нас» — ролик один раз. Файлы кэшируются на год (netlify.toml,
// immutable), поэтому новый ролик кладётся в новую папку версии: меняются TIMELAPSE_VERSION, размеры и
// число кадров, компоненты — нет. Телефону — вырезка 9:16, окно идёт за ЖК (центр ЖК 0,58 → 0,65 ширины).
// v3 — тот же клип без новых генераций, выше качество сборки: лента 1920 и 1280 q75 вместо 1280 q55,
// hero-1080 11 / 8,5 МБ вместо 7 / 5,5. Сборка файлов — out/higgsfield/pipeline/build-hero-v3.mjs (вне git).

export const TIMELAPSE_VERSION = "v3";
export const TIMELAPSE_BASE = `/hero/timelapse/${TIMELAPSE_VERSION}`;
export const TIMELAPSE_FRAME = { width: 1920, height: 1080 } as const;
export const TIMELAPSE_PHONE_FRAME = { width: 608, height: 1080 } as const;
export const PHONE_QUERY = "(max-width: 767px)";

/** Постер — последний кадр ролика (вечер): на главной — первая картинка страницы во всех режимах (LCP). */
export const TIMELAPSE_POSTER = {
  avif: `${TIMELAPSE_BASE}/poster-last-1280.avif 1280w, ${TIMELAPSE_BASE}/poster-last-1920.avif 1920w`,
  webp: `${TIMELAPSE_BASE}/poster-last-1280.webp 1280w, ${TIMELAPSE_BASE}/poster-last-1920.webp 1920w`,
  src: `${TIMELAPSE_BASE}/poster-last-1920.webp`,
  phoneAvif: `${TIMELAPSE_BASE}/poster-portrait-last.avif`,
  phoneWebp: `${TIMELAPSE_BASE}/poster-portrait-last.webp`,
} as const;

/** Ролик по экрану и формату: телефону — 9:16, остальным — 1080p; WebM (VP9) легче, MP4 — где WebM нет. */
export function timelapseVideoSrc({ phone, webm }: { phone: boolean; webm: boolean }): string {
  return `${TIMELAPSE_BASE}/${phone ? "hero-portrait" : "hero-1080"}.${webm ? "webm" : "mp4"}`;
}

/**
 * Лента кадров по прокрутке (full — только десктоп, lib/motion): каждый третий кадр ролика, 8 к/с
 * содержания, WebP q75 — два набора по ширине кадра: 1920×1080 и 1280×720. Набор выбирает frameSetFor
 * (scrub.ts); кадр номер N в обоих — один и тот же кадр ролика. Последний кадр ленты — тот же, что постер.
 */
export const TIMELAPSE_FRAMES = { count: 121, sets: [1920, 1280] } as const;
export type TimelapseFrameSet = (typeof TIMELAPSE_FRAMES.sets)[number];

export const timelapseFrameSrc = (set: TimelapseFrameSet, index: number): string =>
  `${TIMELAPSE_BASE}/frames-${set}/${String(index + 1).padStart(4, "0")}.webp`;
