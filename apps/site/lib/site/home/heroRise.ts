// Первый экран главной «Ufq · Раскол» (03.11.2026, по слову исполнителя: «при заходе рендеров не видно;
// при прокрутке они выходят целиком, центральный чуть шире, все — прямоугольники; затем через
// центральный рендер открывается новая страница»; переходы — motion kit Oryzo: 18 «выезжает из-за
// вордмарка», 07 «фото фокусируется», 13 «нырок и раскол»). Чистые функции без DOM: геометрия
// колоннады по измеренной раскладке и поза каждого слоя на доле пути p — скроллер пишет её прямо в
// transform и opacity элементов (без переменных на секции: так браузер не пересчитывает весь экран).

type Range = readonly [number, number];

export const span = (value: number, [from, to]: Range) =>
  Math.min(1, Math.max(0, (value - from) / (to - from)));
export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeInOutQuart = (t: number) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Липкий экран — только на десктопе не ниже 720: CSS и JS решают по одному и тому же запросу. */
export const STICK_QUERY = "(min-width: 1024px) and (min-height: 720px)";

/** Диск-горизонт по ширине окна. */
export function discSize(vw: number): { w: number; h: number } {
  if (vw < 768) return { w: 1000, h: 440 };
  if (vw < 1024) return { w: 1500, h: 620 };
  return { w: Math.max(2016, vw + 160), h: 750 };
}

/** На сколько горизонт опускается на расстоянии x от оси (эллипс диска). */
export function arcDrop(x: number, { w, h }: { w: number; h: number }): number {
  const ratio = Math.min(1, (2 * x) / w);
  return (h / 2) * (1 - Math.sqrt(1 - ratio * ratio));
}

export type HeroSlot = "c" | "l1" | "r1" | "l2" | "r2";

export type HeroTower = {
  slot: HeroSlot;
  /** Индекс в HERO_RENDERS. */
  render: number;
  /** 0 — центр, 1 — ближние, 2 — крайние (только на широком экране). */
  rank: 0 | 1 | 2;
  /** −1 — слева, 1 — справа, 0 — центр. */
  side: -1 | 0 | 1;
  /** Доля высоты кадра, которую показываем: ниже — то, что прячем (горка, вывеска). */
  safeShare: number;
};

/** Порядок рендеров — HERO_RENDERS: 0 бронза, 1 камень в сумерках, 2 каменная пара, 3 бассейн, 4 парк. */
export const SKYLINE: readonly HeroTower[] = [
  { slot: "c", render: 0, rank: 0, side: 0, safeShare: 0.85 },
  { slot: "l1", render: 2, rank: 1, side: -1, safeShare: 0.85 },
  // Оранжевая горка в кадре — на ≈92 % высоты: остаётся за краем.
  { slot: "r1", render: 4, rank: 1, side: 1, safeShare: 0.85 },
  // Вывеска на фасаде — на ≈83 % высоты: за краем.
  { slot: "l2", render: 1, rank: 2, side: -1, safeShare: 0.65 },
  { slot: "r2", render: 3, rank: 2, side: 1, safeShare: 0.85 },
];

/** Заголовок в финале — у шапки и меньше; рамки — общей высоты, центральная шире. */
export const TITLE_SCALE = 0.58;
const TITLE_GAP = 20;
const GAP_TOP = 28;
const GAP_BOTTOM = 20;
const HIDE = 30;
const BH_MAX = 560;
const WC_MAX = 300;
const RATIO_C = 0.58;
const RATIO_N = 0.8;
const RATIO_F = 0.68;
const EDGE = 48;
const FILE_WIDTH = 736;

/** Раскладка, измеренная скроллером: размеры окна и места текста и горизонта в липкой сцене. */
export type HeroMeasure = {
  vw: number;
  vh: number;
  /** Высота шапки. */
  header: number;
  /** Верх и высота заголовка (без transform). */
  titleTop: number;
  titleH: number;
  /** Линия горизонта — верх полосы фактов. */
  horizon: number;
  /** На столько опускается горизонт, пока уходят «бесплатно». */
  settle: number;
  /** Пропорция центрального файла (ширина/высота). */
  centerRatio: number;
};

export type TowerBox = { x: number; w: number; left: number; top: number; riseY: number };

export type HeroGeom = {
  vw: number;
  vh: number;
  /** Общая высота рамок; низ рамок в финале. */
  height: number;
  bottom: number;
  /** Сдвиг заголовка к шапке. */
  titleShift: number;
  towers: Partial<Record<Exclude<HeroSlot, "c">, TowerBox>>;
  /** Центральная рамка разложена в размере «нырка» и сжата transform — растяжения нет никогда. */
  center: {
    left: number;
    top: number;
    w: number;
    h: number;
    /** Масштаб в покое и подъёме; сдвиг в финале подъёма и в покое (спрятана). */
    scale: number;
    tyFinal: number;
    tyRest: number;
  };
  /** Линия раскола — середина центральной рамки. */
  seam: number;
};

/** Рамки колоннады в финале подъёма: высота общая, центральная шире; крайние — если помещаются. */
function colonnade(input: HeroMeasure) {
  const { vw, header, titleH, horizon, settle } = input;
  const disc = discSize(vw);
  const textBottom = header + TITLE_GAP + TITLE_SCALE * titleH + GAP_TOP;
  const bottom = horizon + settle - GAP_BOTTOM;
  const height = Math.max(160, Math.min(BH_MAX, bottom - textBottom));
  const wc = Math.min(WC_MAX, Math.round(RATIO_C * height));
  const wn = Math.round(RATIO_N * wc);
  const wf = Math.round(RATIO_F * wc);
  const gap = vw >= 1360 ? 24 : 20;
  const finalTop = bottom - height;
  /** В покое верх рамки — ниже края диска над её внешним углом: не видна целиком. */
  const restTop = (x: number, w: number) => horizon + arcDrop(Math.abs(x) + w / 2, disc) + HIDE;
  const box = (x: number, w: number): TowerBox => ({
    x,
    w,
    left: vw / 2 + x - w / 2,
    top: finalTop,
    riseY: restTop(x, w) - finalTop,
  });
  const xn = wc / 2 + gap + wn / 2;
  const xf = wc / 2 + gap + wn + gap + wf / 2;
  const towers: HeroGeom["towers"] = { l1: box(-xn, wn), r1: box(xn, wn) };
  if (vw >= 1360 && xf + wf / 2 <= vw / 2 - EDGE) {
    towers.l2 = box(-xf, wf);
    towers.r2 = box(xf, wf);
  }
  return { height, bottom, wc, towers, restCenter: restTop(0, wc) };
}

export function heroLayout(input: HeroMeasure): HeroGeom {
  const { vw, vh, header, titleTop, centerRatio } = input;
  const { height, bottom, wc, towers, restCenter } = colonnade(input);
  // «Нырок»: во всю высоту под шапкой; если кадр там мельче файла не встанет — ниже и по центру.
  let fh = vh - header;
  let fw = Math.round((fh * wc) / height);
  const imageWidth = Math.max(fw, (fh / 0.85) * centerRatio);
  if (imageWidth > FILE_WIDTH) {
    fh = Math.round((fh * FILE_WIDTH) / imageWidth);
    fw = Math.round((fh * wc) / height);
  }
  const top = header + (vh - header - fh) / 2;
  const cy = top + fh / 2;
  return {
    vw,
    vh,
    height,
    bottom,
    titleShift: header + TITLE_GAP - titleTop,
    towers,
    center: {
      left: vw / 2 - fw / 2,
      top,
      w: fw,
      h: fh,
      scale: height / fh,
      tyFinal: bottom - height / 2 - cy,
      tyRest: restCenter + height / 2 - cy,
    },
    seam: cy,
  };
}

/** Поза слоя: сдвиг (px), масштаб и прозрачность. */
export type Pose = { tx: number; ty: number; s: number; o: number };
const pose = (tx = 0, ty = 0, s = 1, o = 1): Pose => ({ tx, ty, s, o });

export type ActLayer =
  | "out-eyebrow"
  | "out-lead"
  | "out-actions"
  | "out-cue"
  | "title"
  | "perks"
  | "horizon"
  | "ledger"
  | "glow"
  | "sky"
  | "edge"
  | "plate-top"
  | "plate-bottom"
  | "half-top"
  | "half-bottom"
  | HeroSlot;

/**
 * Такты липкого пути (доли p; путь — --home-hero-travel, 384svh). Пауза — между подъёмом и нырком.
 * Раскол — в конце: каталог под пластинами едет 1:1 с прокруткой и к началу раскола стоит у шва
 * (~54svh до конца пути), поэтому раскол короче остальных тактов — иначе щель покажет пустой фон.
 */
export const ACT = {
  cue: [0, 0.07],
  eyebrow: [0, 0.16],
  lead: [0.023, 0.206],
  actions: [0.046, 0.252],
  title: [0.046, 0.39],
  center: [0.069, 0.367],
  near: [0.115, 0.401],
  far: [0.16, 0.435],
  settle: [0.092, 0.344],
  glow: [0.115, 0.435],
  dive: [0.527, 0.848],
  split: [0.86, 0.985],
} as const satisfies Record<string, Range>;

/**
 * С COPY_FADE_AT кнопки начинают гаснуть: фокус в тексте возвращает к началу сцены (WCAG 2.4.7 —
 * обводка не бывает полупрозрачной); с OUT_AT текст не ловит клики (середина угасания кнопок); с
 * LEDGER_OUT_AT фактов не видно; с SPLIT_AT сцена пропускает клики к каталогу в щели; THROUGH — пройдена.
 */
export const COPY_FADE_AT = 0.046;
export const OUT_AT = 0.149;
export const SPLIT_AT = 0.86;
export const LEDGER_OUT_AT = 0.527;
export const THROUGH = { on: 0.99, off: 0.986 } as const;

export type HeroPhase = "rest" | "rise" | "hold" | "dive" | "split" | "through";

export function heroPhase(p: number): HeroPhase {
  if (p <= 0) return "rest";
  if (p < ACT.far[1]) return "rise";
  if (p < ACT.dive[0]) return "hold";
  if (p < ACT.split[0]) return "dive";
  return p < THROUGH.on ? "split" : "through";
}

const fade = (value: number, [from, to]: Range) => 1 - span(value, [from, to]);

/** Боковая рамка: выходит из-за горизонта, на «нырке» уезжает вбок, крупнеет и гаснет. */
function sidePose(geom: HeroGeom, slot: Exclude<HeroSlot, "c">, p: number, d: number): Pose {
  const box = geom.towers[slot];
  if (!box) return pose(0, 0, 1, 0);
  const far = slot === "l2" || slot === "r2";
  const sign = Math.sign(box.x);
  const tx = sign * (far ? 0.55 * geom.vw * d ** 1.2 : 0.42 * geom.vw * d ** 1.4);
  const rise = 1 - easeOut(span(p, far ? ACT.far : ACT.near));
  const opacity = fade(d, far ? [0.15, 0.6] : [0.35, 0.85]);
  return pose(tx, box.riseY * rise, 1 + (far ? 0.25 : 0.18) * d, opacity);
}

/** Центральная: выходит из-за горизонта в размере колоннады, на «нырке» растёт до своего (1:1). */
function centerPose({ center }: HeroGeom, p: number, dive: number): Pose {
  const ty =
    p < ACT.dive[0]
      ? lerp(center.tyRest, center.tyFinal, easeOut(span(p, ACT.center)))
      : lerp(center.tyFinal, 0, dive);
  return pose(0, ty, lerp(center.scale, 1, dive));
}

/** Текст, заголовок и горизонт: уходят, уменьшаются, опускаются. */
function copyPoses(p: number, d: number, geom: HeroGeom, settle: number) {
  const out = (range: Range) => {
    const t = span(p, range);
    return pose(0, -24 * t, 1, 1 - t);
  };
  const title = easeInOut(span(p, ACT.title));
  const gone = span(d, [0, 0.35]);
  return {
    "out-cue": out(ACT.cue),
    "out-eyebrow": out(ACT.eyebrow),
    "out-lead": out(ACT.lead),
    "out-actions": out(ACT.actions),
    title: pose(0, title * geom.titleShift - 32 * gone, 1 - (1 - TITLE_SCALE) * title, 1 - gone),
    perks: pose(0, 0, 1, 1 - span(p, ACT.settle)),
    horizon: pose(0, settle * easeInOut(span(p, ACT.settle))),
  };
}

/** Позы всех слоёв на доле пути p. */
export function actFrame(p: number, geom: HeroGeom, settle: number): Record<ActLayer, Pose> {
  const d = span(p, ACT.dive);
  const dive = easeInOut(d);
  const split = easeInOutQuart(span(p, ACT.split));
  const { seam, vh } = geom;
  const up = -split * (seam + 32);
  const down = split * (vh - seam + 32);
  return {
    ...copyPoses(p, d, geom, settle),
    ledger: pose(0, 0.5 * vh * dive, 1, fade(d, [0, 0.5])),
    glow: pose(0, 0, 1, (0.45 + 0.55 * span(p, ACT.glow)) * fade(d, [0, 0.4])),
    sky: pose(0, 0, 1, fade(d, [0.25, 0.85])),
    edge: pose(0, 0, 1, fade(d, [0, 0.2])),
    c: centerPose(geom, p, dive),
    l1: sidePose(geom, "l1", p, d),
    r1: sidePose(geom, "r1", p, d),
    l2: sidePose(geom, "l2", p, d),
    r2: sidePose(geom, "r2", p, d),
    "plate-top": pose(0, up),
    "plate-bottom": pose(0, down),
    "half-top": pose(0, up, 1 + 0.03 * split),
    "half-bottom": pose(0, down, 1 + 0.03 * split),
  };
}

/**
 * «Фото фокусируется» (motion kit 07, только full): картинка в рамке чуть крупнее и садится на место,
 * пока рамка выходит из-за горизонта. Масштаб — не больше 1,06: рендер не растягивается заметно.
 */
export function focusScale(p: number, rank: 0 | 1 | 2): number {
  const range = rank === 0 ? ACT.center : rank === 1 ? ACT.near : ACT.far;
  return 1 + 0.06 * (1 - easeOut(span(p, range)));
}

/** Без липкости (телефон, планшет, низкое окно): рамки поднимаются из-за горизонта, пока экран уезжает. */
export const DRIFT = { c: [0, 0.4], near: [0.08, 0.5] } as const satisfies Record<string, Range>;

export function driftRise(d: number, rank: 0 | 1 | 2): number {
  return 1 - easeOut(span(d, rank === 0 ? DRIFT.c : DRIFT.near));
}
