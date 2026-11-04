import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { RollText } from "@/components/RollText";
import { HeroLink } from "./HeroLink";
import type { HeroText } from "./types";

type HeroCopyProps = {
  text: HeroText;
  ctaHref: string;
  titleId: string;
  /** «✦ Подбор за 1 минуту» (HeroQuizLink) — вторая кнопка рядом с главной. */
  quiz: ReactNode;
  /** «Листайте» с бегущей точкой под кнопками — видна только в full на липком экране (CSS). */
  cue?: string | null;
};

/**
 * Текст первого экрана по схеме hero-1, по центру: пилюля-надзаголовок, заголовок (графитовый
 * градиент, курсив Cormorant бронзой), обещание и две кнопки. Каждый блок — в своей обёртке: по
 * прокрутке липкого экрана пилюля, обещание и кнопки уходят (__out), заголовок поднимается к шапке
 * (__title), а вступление играет на внутреннем слое — transform одного не спорит с другим.
 */
export function HeroCopy({ text, ctaHref, titleId, quiz, cue }: HeroCopyProps) {
  return (
    <div className="home-hero__copy">
      <div className="home-hero__out home-hero__out--eyebrow">
        <p className="home-hero__pill">{text.eyebrow}</p>
      </div>
      <div className="home-hero__title">
        <div className="home-hero__title-in">
          <h1 id={titleId} className="home-hero__h1">
            {text.titleLead} <span className="home-hero__accent">{text.titleAccent}</span>
          </h1>
        </div>
      </div>
      <div className="home-hero__out home-hero__out--lead">
        <p className="home-hero__lead">{text.lead}</p>
      </div>
      <div className="home-hero__out home-hero__out--actions">
        <div className="home-hero__actions">
          <HeroLink href={ctaHref} className="button button--primary home-hero__cta roll-trigger">
            <RollText text={text.cta} />
            <ArrowRight size={18} aria-hidden="true" />
          </HeroLink>
          {quiz}
        </div>
      </div>
      {cue ? (
        <div className="home-hero__out home-hero__out--cue" aria-hidden="true">
          <p className="home-hero__cue">
            <span className="home-hero__cue-line" />
            {cue}
          </p>
        </div>
      ) : null}
    </div>
  );
}
