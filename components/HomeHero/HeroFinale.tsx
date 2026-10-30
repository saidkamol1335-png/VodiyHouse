import { ArrowRight } from "lucide-react";
import { RollText } from "@/components/RollText";
import { HeroLink } from "./HeroLink";
import type { HeroText } from "./types";

type HeroFinaleProps = { text: HeroText; href: string };

/**
 * Только full: финал «Дом сдан» слева внизу — проявляется на последних кадрах ленты (переменная
 * --hero-finale, класс home-hero--finale). До финала блок невидим и не ловит фокус и клики.
 */
export function HeroFinale({ text, href }: HeroFinaleProps) {
  return (
    <div className="home-hero__finale">
      <div className="home-hero__finale-body">
        <p className="home-hero__finale-title">{text.finaleTitle}</p>
        <p className="home-hero__finale-text">{text.finaleText}</p>
        <HeroLink href={href} className="button button--primary home-hero__cta roll-trigger">
          <RollText text={text.finaleCta} />
          <ArrowRight size={18} aria-hidden="true" />
        </HeroLink>
      </div>
    </div>
  );
}
