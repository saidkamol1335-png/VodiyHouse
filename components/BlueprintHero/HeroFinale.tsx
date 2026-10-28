import { HeroLink } from "./HeroLink";
import type { HeroText } from "./types";

type HeroFinaleProps = { text: HeroText; finaleHref: string };

/**
 * Только full: подсказка «Листайте» по центру внизу (гаснет со вступлением) и финал «Дом сдан»
 * слева внизу, который проявляется на последних кадрах (переменная --hero-finale, класс
 * blueprint-hero--finale — Scrubber). До финала блок невидим и не ловит фокус.
 */
export function HeroFinale({ text, finaleHref }: HeroFinaleProps) {
  return (
    <>
      <p className="blueprint-hero__scroll-cue" aria-hidden="true">
        {text.scrollCue}
        <span className="blueprint-hero__scroll-line" />
      </p>
      <div className="blueprint-hero__finale">
        <p className="blueprint-hero__finale-title">{text.finaleTitle}</p>
        <p className="blueprint-hero__finale-text">{text.finaleText}</p>
        <HeroLink href={finaleHref} className="blueprint-hero__button blueprint-hero__button--primary">
          <span className="blueprint-hero__button-mark" />
          {text.finaleCta}
        </HeroLink>
      </div>
    </>
  );
}
