import type { ReactNode } from "react";
import { HeroLink } from "./HeroLink";
import type { HeroStat, HeroText } from "./types";

type HeroCopyProps = {
  text: HeroText;
  stats: readonly HeroStat[];
  ctaHref: string;
  secondaryHref: string;
  titleId: string;
  /** Под «бесплатно»: «Найдено сейчас» (HeroQuickPick) и «Подбор за 1 минуту» (HeroQuizLink, 3.17). */
  children?: ReactNode;
};

/** Стрелка вниз у второй кнопки — тонкий штрих в стиле портфолио. */
function Arrow() {
  return (
    <svg className="blueprint-hero__button-arrow" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 3v10M3.5 8.5 8 13l4.5-4.5" />
    </svg>
  );
}

/** Текст первого экрана: надзаголовок и пилюля, заголовок (LCP-текст, без анимации), кнопки, «бесплатно», цифры. */
export function HeroCopy({ text, stats, ctaHref, secondaryHref, titleId, children }: HeroCopyProps) {
  return (
    <div className="blueprint-hero__content">
      <div className="blueprint-hero__intro">
        <div className="blueprint-hero__meta">
          <p className="blueprint-hero__eyebrow">
            <span className="blueprint-hero__eyebrow-line" />
            {text.eyebrow}
          </p>
          <p className="blueprint-hero__chip">
            <span className="blueprint-hero__chip-dot" />
            {text.chip}
          </p>
        </div>
        <h1 id={titleId} className="blueprint-hero__title">
          <span className="blueprint-hero__title-lead">{text.titleLead}</span>{" "}
          <span className="blueprint-hero__title-accent">{text.titleAccent}</span>
        </h1>
        <p className="blueprint-hero__lead">{text.lead}</p>
        <div className="blueprint-hero__actions">
          <HeroLink href={ctaHref} className="blueprint-hero__button blueprint-hero__button--primary">
            <span className="blueprint-hero__button-mark" />
            {text.cta}
          </HeroLink>
          <HeroLink href={secondaryHref} className="blueprint-hero__button blueprint-hero__button--ghost">
            {text.secondaryCta}
            <Arrow />
          </HeroLink>
        </div>
        <ul className="blueprint-hero__perks">
          {text.perks.map((perk) => (
            <li key={perk} className="blueprint-hero__perk">
              {perk}
            </li>
          ))}
        </ul>
        {children ? <div className="blueprint-hero__quick">{children}</div> : null}
      </div>
      {stats.length > 0 ? <HeroStats stats={stats} label={text.statsLabel} /> : null}
    </div>
  );
}

/** Цифры из каталога: число серебром, подпись моно капсом; dt — подпись, dd — число (как читает диктор). */
function HeroStats({ stats, label }: { stats: readonly HeroStat[]; label: string }) {
  return (
    <dl className="blueprint-hero__stats" aria-label={label}>
      {stats.map((item) => (
        <div key={item.key} className="blueprint-hero__stat">
          <dt className="blueprint-hero__stat-label">{item.label}</dt>
          <dd className="blueprint-hero__stat-value">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
