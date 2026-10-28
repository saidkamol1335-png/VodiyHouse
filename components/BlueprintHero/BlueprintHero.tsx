"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useMotion } from "@/lib/motion";
import { HeroCopy } from "./HeroCopy";
import { HeroFinale } from "./HeroFinale";
import { HeroMedia } from "./HeroMedia";
import { HeroRail } from "./HeroRail";
import { HERO_SCRUB_VH } from "./stages";
import type { HeroStat, HeroText } from "./types";
import { useFrameScrub } from "./useFrameScrub";
import { useHeroOverHeader } from "./useHeroOverHeader";
import { useHeroState } from "./useHeroState";
import { useHeroVideo } from "./useHeroVideo";

type BlueprintHeroProps = {
  text: HeroText;
  /** Цифры из каталога; пусто — каталог не прочитался, экран без цифр. */
  stats: readonly HeroStat[];
  ctaHref: string;
  secondaryHref: string;
  finaleHref: string;
  /** Быстрый подбор под кнопками: «найдено сейчас» (мокап), с 3.17 — «Подбор за 1 минуту». */
  children?: ReactNode;
};

const TITLE_ID = "blueprint-hero-title";

/**
 * Первый экран «Чертёж → стройка» (блок H, временно до ролика Higgsfield): CGI-таймлапс стройки
 * по этапам. Режим — tier сайта (CLAUDE.md, «Анимации»): full — лента кадров по прокрутке на
 * холсте, сначала синька, затем стройка и финал «Дом сдан»; lite — MP4 без звука играет сам и
 * держит последний кадр; none — постер «Дом сдан». Текст слева, лента этапов справа, отметка
 * внизу справа; на телефоне — плашка этапа вверху справа.
 */
export function BlueprintHero({ text, stats, ctaHref, secondaryHref, finaleHref, children }: BlueprintHeroProps) {
  const tier = useMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hero = useHeroState(tier);
  useHeroOverHeader(sectionRef);
  useFrameScrub({ enabled: hero.mode === "full", section: sectionRef, canvas: canvasRef, onFrame: hero.onFrame, onDrawn: hero.onDrawn });
  useHeroVideo({ enabled: hero.mode === "lite", section: sectionRef, video: videoRef, onFrame: hero.onFrame, onBlocked: hero.onBlocked });

  const classes = ["blueprint-hero", `blueprint-hero--${hero.mode}`];
  if (hero.drawn) classes.push("blueprint-hero--ready");
  const style = { "--hero-scrub": `${HERO_SCRUB_VH}vh` } as CSSProperties;
  return (
    <section ref={sectionRef} className={classes.join(" ")} style={style} data-stage={hero.stage} aria-labelledby={TITLE_ID}>
      <div className="blueprint-hero__sticky">
        <HeroMedia mode={hero.mode} canvas={canvasRef} video={videoRef} />
        <HeroCopy text={text} stats={stats} ctaHref={ctaHref} secondaryHref={secondaryHref} titleId={TITLE_ID}>
          {children}
        </HeroCopy>
        {hero.mode !== "none" ? <HeroRail text={text} stage={hero.stage} elevationRef={hero.elevationRef} /> : null}
        {hero.mode === "full" ? <HeroFinale text={text} finaleHref={finaleHref} /> : null}
      </div>
    </section>
  );
}
