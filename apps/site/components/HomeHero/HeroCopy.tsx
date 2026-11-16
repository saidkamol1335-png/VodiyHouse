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
  /** Цифры каталога под кнопками (правки 15.11, п. 1: «рядом с кнопками»); каталог не прочитался — null. */
  stats: ReactNode;
};

/**
 * Текст первого экрана по схеме hero-1, по центру: пилюля-надзаголовок, заголовок (графитовый
 * градиент, курсив Cormorant бронзой), обещание, две кнопки и цифры каталога. Каждый блок — в своей
 * обёртке: вступление играет на внутреннем слое.
 */
export function HeroCopy({ text, ctaHref, titleId, quiz, stats }: HeroCopyProps) {
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
      {stats ? <div className="home-hero__out home-hero__out--stats">{stats}</div> : null}
    </div>
  );
}
