import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/Eyebrow";
import { Heading } from "@/components/Heading";
import { HeroLink } from "./HeroLink";
import type { HeroText } from "./types";

type HeroCopyProps = {
  text: HeroText;
  ctaHref: string;
  titleId: string;
  /** «✦ Подбор за 1 минуту» (HeroQuizLink) — вторая кнопка рядом с главной. */
  quiz: ReactNode;
  /** Только full: «Листайте» с бегущей точкой после кнопок (как в артефакте «Закат»). */
  cue?: string | null;
};

/**
 * Текст первого экрана по мокапу Main: надзаголовок, заголовок с курсивом «по цене застройщика»
 * (LCP-текст, без анимации), обещание, янтарная «Подобрать квартиру» и «Подбор за 1 минуту».
 */
export function HeroCopy({ text, ctaHref, titleId, quiz, cue }: HeroCopyProps) {
  return (
    <div className="home-hero__copy">
      <Eyebrow>{text.eyebrow}</Eyebrow>
      <div id={titleId} className="home-hero__title">
        <Heading level={1} accent={text.titleAccent}>
          {text.titleLead}{" "}
        </Heading>
      </div>
      <p className="home-hero__lead">{text.lead}</p>
      <div className="home-hero__actions">
        <HeroLink href={ctaHref} className="button button--primary home-hero__cta">
          {text.cta}
          <ArrowRight size={18} aria-hidden="true" />
        </HeroLink>
        {quiz}
        {cue ? (
          <p className="home-hero__cue" aria-hidden="true">
            <span className="home-hero__cue-line" />
            {cue}
          </p>
        ) : null}
      </div>
    </div>
  );
}
