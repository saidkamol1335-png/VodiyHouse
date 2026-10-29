export type HeroText = {
  eyebrow: string;
  titleLead: string;
  /** Курсив Cormorant янтарём: «по цене застройщика». */
  titleAccent: string;
  lead: string;
  cta: string;
  /** «Для вас бесплатно» (ТЗ 1а) — три пункта с галочками. */
  perks: readonly string[];
  statsLabel: string;
};

export type HeroStat = { key: string; label: string; value: string };
