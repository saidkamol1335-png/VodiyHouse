export type HeroText = {
  eyebrow: string;
  titleLead: string;
  /** Курсив Cormorant янтарём: «по цене застройщика». */
  titleAccent: string;
  lead: string;
  cta: string;
  statsLabel: string;
  slides: HeroSlidesText;
};

/** Рендеры первого экрана: имя группы для диктора и подпись «иллюстративный характер». */
export type HeroSlidesText = { label: string; note: string };

export type HeroStat = { key: string; label: string; value: string };
