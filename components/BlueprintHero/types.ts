export type HeroText = {
  eyebrow: string;
  /** Пилюля рядом с надзаголовком: «Подбор и показ бесплатно». */
  chip: string;
  titleLead: string;
  titleAccent: string;
  lead: string;
  cta: string;
  secondaryCta: string;
  scrollCue: string;
  finaleTitle: string;
  finaleText: string;
  finaleCta: string;
  stageLabel: string;
  elevationLabel: string;
  /** Восемь этапов в порядке ролика (stages.ts, STAGE_KEYS). */
  stages: readonly string[];
  /** «Для вас бесплатно» (ТЗ 1а) — строкой под кнопками. */
  perks: readonly string[];
  statsLabel: string;
};

export type HeroStat = { key: string; label: string; value: string };

/** Режим экрана: full — кадры по прокрутке, lite — MP4, none — постер «Дом сдан». */
export type HeroMode = "full" | "lite" | "none";

/** Кадр может быть дробным (лента догоняет прокрутку с замедлением). */
export type ScrubFrame = { frame: number; progress: number };
