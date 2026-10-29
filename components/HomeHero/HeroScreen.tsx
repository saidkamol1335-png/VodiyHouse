"use client";

import { useRef, type ReactNode } from "react";
import { TimelapseToggle, type TimelapseToggleLabels } from "@/components/TimelapseToggle";
import { useTimelapse } from "@/lib/site/timelapse/useTimelapse";
import { HeroCopy } from "./HeroCopy";
import { HeroFacts } from "./HeroFacts";
import { HeroMedia } from "./HeroMedia";
import type { HeroStat, HeroText } from "./types";
import { useHeroOverHeader } from "./useHeroOverHeader";

type HeroScreenProps = {
  text: HeroText;
  stats: readonly HeroStat[];
  ctaHref: string;
  /** «✦ Подбор за 1 минуту» — серверная ссылка (HeroQuizLink). */
  quiz: ReactNode;
  /** «Найдено сейчас» — серверная плашка (HeroQuickPick); каталог не прочитался — null. */
  found: ReactNode;
  toggleLabels: TimelapseToggleLabels;
};

const TITLE_ID = "home-hero-title";

/**
 * Первый экран главной: ролик стройки на весь экран (ЖК справа), слева текст и кнопки мокапа Main
 * под тёмной пеленой, внизу «бесплатно», цифры и «Найдено сейчас». Тёмный в обеих темах (островок
 * data-theme-island). Режим — tier сайта: full и lite — ролик один раз (с паузой кнопкой), затем
 * постер «вечер»; none — только постер.
 */
export function HeroScreen({ text, stats, ctaHref, quiz, found, toggleLabels }: HeroScreenProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hero = useTimelapse({ host: mediaRef, video: videoRef, portraitOnPhone: true });
  useHeroOverHeader(sectionRef);

  const classes = ["home-hero", `home-hero--${hero.mode}`];
  if (hero.playing) classes.push("home-hero--playing");
  return (
    <section
      ref={sectionRef}
      className={classes.join(" ")}
      data-theme-island="dark"
      aria-labelledby={TITLE_ID}
    >
      <HeroMedia mode={hero.mode} media={mediaRef} video={videoRef} />
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__inner">
        <HeroCopy text={text} ctaHref={ctaHref} titleId={TITLE_ID} quiz={quiz} />
        <HeroFacts text={text} stats={stats} found={found} />
      </div>
      {hero.playing ? (
        <TimelapseToggle
          paused={hero.paused}
          labels={toggleLabels}
          onToggle={hero.toggle}
          className="home-hero__toggle"
        />
      ) : null}
    </section>
  );
}
