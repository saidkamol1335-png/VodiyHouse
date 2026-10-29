// Ролик стройки ЖК (Seedance 2.5, 1080p, 15 с, 30.10.2026): от пустого участка до синего часа, камера
// неподвижна. Играет на первом экране главной, в панели «Застройщикам» и фоном карточки «О нас».
// Файлы кэшируются на год (netlify.toml, immutable), поэтому новый ролик кладётся в новую папку версии:
// меняются TIMELAPSE_VERSION и размеры, компоненты — нет. Телефону — вырезка 9:16 из того же ролика
// (608×1080), пока нет своего 9:16. Сборка файлов — out/higgsfield/pipeline/build-hero-video.mjs (вне git).

export const TIMELAPSE_VERSION = "v1";
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
