"use client";

import { useRef, type ReactNode } from "react";
import { HeroCopy } from "./HeroCopy";
import { HeroFacts } from "./HeroFacts";
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
 * небо из кости с чертёжной сеткой, по центру пилюля, заголовок, обещание и кнопки; внизу —
 * травертиновый диск-горизонт, на нём подпись, «бесплатно», цифры и «Найдено сейчас»; рендеры спрятаны
 * за горизонтом. Прокрутка («Раскол», useHeroScroll): рамки выходят целиком, камера «ныряет» в
 * центральную, экран раскалывается по ней (две травертиновые пластины) — в щель поднимается каталог.
 */
export function HeroScreen({ text, stats, ctaHref, quiz, found }: HeroScreenProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hero = useHeroScreen({ section: sectionRef });
  return (
    <section ref={sectionRef} className={hero.className} aria-labelledby={TITLE_ID}>
      <div className="home-hero__track">
        <div className="home-hero__stage">
          <div className="home-hero__plate home-hero__plate--top" aria-hidden="true" />
          <div className="home-hero__plate home-hero__plate--bottom" aria-hidden="true">
            <p className="home-hero__plate-note">{text.slides.note}</p>
          </div>
          <div className="home-hero__sky" aria-hidden="true">
            <div className="home-hero__grid" />
            <div className="home-hero__glow" />
          </div>
          <HeroCopy
            text={text}
            ctaHref={ctaHref}
            titleId={TITLE_ID}
            quiz={quiz}
            cue={text.scrollCue}
          />
          <HeroSkyline label={text.slides.label} noteId={NOTE_ID} />
          <HeroFacts text={text} stats={stats} found={found} noteId={NOTE_ID} />
        </div>
      </div>
    </section>
  );
}
