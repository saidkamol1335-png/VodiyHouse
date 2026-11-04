// Рендеры первого экрана главной (03.11.2026, слово исполнителя «для анимации главной воспользуйся
// этими рендерами»): исходники заказчика 736 px — docs/hero-renders/source, в public — AVIF и WebP
// 480 и 736 px без увеличения. Файлы кэшируются на год (netlify.toml): новый набор — новая папка v2.
// Рендеры условные, не настоящие ЖК Ферганы: без названий, цен и ссылок, с подписью «иллюстративный
// характер». Квадратный twin-towers-podium и горизонтальные кадры в высокой рамке растягивались бы —
// их файлы лежат без ссылок.

export const HERO_RENDERS_BASE = "/hero/renders/v1";

export type HeroRender = {
  slug: string;
  width: number;
  height: number;
  /** Средний цвет кадра: фон слайда, пока картинка декодируется. */
  tint: string;
  /** object-position кадра в рамке башни. */
  focus: string;
};

/** Порядок показа: первый — LCP и постер режима none (бронза и шампань скина). */
export const HERO_RENDERS: readonly HeroRender[] = [
  {
    slug: "bronze-tower-sunset",
    width: 736,
    height: 1362,
    tint: "#7a736f",
    focus: "50% 0%",
  },
  {
    slug: "stone-tower-dusk",
    width: 736,
    height: 1362,
    tint: "#616570",
    focus: "45% 0%",
  },
  {
    slug: "stone-pair",
    width: 736,
    height: 1362,
    tint: "#8b8379",
    focus: "50% 0%",
  },
  {
    slug: "white-tower-pool",
    width: 736,
    height: 981,
    tint: "#75777b",
    focus: "50% 0%",
  },
  {
    slug: "white-towers-park",
    width: 736,
    height: 1362,
    tint: "#9b9895",
    focus: "45% 0%",
  },
];

/**
 * Ширина нарисованной картинки первого экрана (heroRise) — рамка выше на 1/safe, картинка шире
 * рамки: центральная на десктопе разложена в размере «нырка» (до ~560 px), боковые — ~330, крайние —
 * ~460. На DPR 2 браузер берёт файл 736; крупнее файлов нет — оригиналы ≥ 1500 px у заказчика (TODO).
 */
export const HERO_SIZES = {
  c: "(min-width: 1024px) 560px, (min-width: 768px) 240px, 150px",
  side1: "(min-width: 1024px) 330px, (min-width: 768px) 210px, 120px",
  side2: "460px",
} as const;

export const HERO_RENDER_SIZES = HERO_SIZES.c;

const WIDTHS = [480, 736] as const;

export function renderSrcSet(slug: string, format: "avif" | "webp"): string {
  return WIDTHS.map((width) => `${HERO_RENDERS_BASE}/${slug}-${width}.${format} ${width}w`).join(
    ", ",
  );
}

export function renderSrc(slug: string): string {
  return `${HERO_RENDERS_BASE}/${slug}-736.webp`;
}
