"use client";

import { useRef, type ReactNode } from "react";
import { HeroCopy } from "./HeroCopy";
import { HeroFacts, HeroStats } from "./HeroFacts";
import { HeroSkyline } from "./HeroSkyline";
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
};

const TITLE_ID = "home-hero-title";
const NOTE_ID = "home-hero-note";

/**
 * Первый экран главной «Ufq» (03.11.2026, по схеме hero-1 с 21st.dev в палитре Vodiy House): светлое
 * небо из кости с чертёжной сеткой, по центру пилюля, заголовок, обещание, кнопки и цифры каталога; над
 * травертиновым диском-горизонтом — колоннада рендеров ЖК, ниже — подпись, «бесплатно» и «Найдено
 * сейчас». Правки 15.11, п. 1: рендеры и цифры видны сразу, без прокрутки; сцена «Раскол» убрана.
 */
export function HeroScreen({ text, stats, ctaHref, quiz, found }: HeroScreenProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hero = useHeroScreen({ section: sectionRef });
  return (
    <section ref={sectionRef} className={hero.className} aria-labelledby={TITLE_ID}>
      <div className="home-hero__track">
        <div className="home-hero__stage">
          <div className="home-hero__sky" aria-hidden="true">
            <div className="home-hero__grid" />
            <div className="home-hero__glow" />
          </div>
          <HeroCopy
            text={text}
            ctaHref={ctaHref}
            titleId={TITLE_ID}
            quiz={quiz}
            stats={stats.length > 0 ? <HeroStats stats={stats} label={text.statsLabel} /> : null}
          />
          <HeroSkyline label={text.slides.label} noteId={NOTE_ID} />
          <HeroFacts text={text} found={found} noteId={NOTE_ID} />
        </div>
      </div>
    </section>
  );
}
