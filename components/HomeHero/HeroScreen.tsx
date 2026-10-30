"use client";

import { useRef, type ReactNode } from "react";
import { TimelapseToggle, type TimelapseToggleLabels } from "@/components/TimelapseToggle";
import { HeroCopy } from "./HeroCopy";
import { HeroFacts } from "./HeroFacts";
import { HeroFinale } from "./HeroFinale";
import { HeroMedia } from "./HeroMedia";
import type { HeroStat, HeroText } from "./types";
import { useHeroScreen } from "./useHeroScreen";

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
 * Первый экран главной: полёт дрона над стройкой на весь экран (ЖК справа), слева текст и кнопки
 * мокапа Main под тёмной пеленой, внизу «бесплатно», цифры и «Найдено сейчас». Тёмный в обеих темах
 * (островок data-theme-island). Режим — tier сайта: full — лента кадров по прокрутке, как в артефакте
 * «Закат» (текст гаснет, на последних кадрах — финал «Дом сдан»); lite — ролик один раз (с паузой
 * кнопкой), затем постер «вечер»; none — только постер.
 */
export function HeroScreen({ text, stats, ctaHref, quiz, found, toggleLabels }: HeroScreenProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hero = useHeroScreen({
    section: sectionRef,
    media: mediaRef,
    video: videoRef,
    canvas: canvasRef,
  });

  return (
    <section
      ref={sectionRef}
      className={hero.className}
      data-theme-island="dark"
      aria-labelledby={TITLE_ID}
    >
      <HeroMedia mode={hero.mode} media={mediaRef} video={videoRef} canvas={canvasRef} />
      <div className="home-hero__shade" aria-hidden="true" />
      <div className="home-hero__inner">
        <HeroCopy
          text={text}
          ctaHref={ctaHref}
          titleId={TITLE_ID}
          quiz={quiz}
          cue={hero.full ? text.scrollCue : null}
        />
        <HeroFacts text={text} stats={stats} found={found} />
      </div>
      {hero.full ? <HeroFinale text={text} href={ctaHref} /> : null}
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
