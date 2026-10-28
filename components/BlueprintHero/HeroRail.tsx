import type { RefObject } from "react";
import { padIndex, STAGE_COUNT } from "./stages";
import type { HeroText } from "./types";

type HeroRailProps = {
  text: HeroText;
  stage: number;
  /** Отметка высоты — обновляется прямо в DOM на каждый кадр (useHeroState). */
  elevationRef: RefObject<HTMLSpanElement | null>;
};

function railItemClass(index: number, current: number): string {
  if (index === current) return "blueprint-hero__rail-item blueprint-hero__rail-item--active";
  return index < current ? "blueprint-hero__rail-item blueprint-hero__rail-item--done" : "blueprint-hero__rail-item";
}

/**
 * Лента этапов справа (точки, подпись — у текущего), на планшете и телефоне — только пилюля
 * текущего этапа вверху справа; отметка внизу справа: этап и высота. Диктору — скрытый список
 * этапов (их порядок — часть смысла экрана), остальное украшение.
 */
export function HeroRail({ text, stage, elevationRef }: HeroRailProps) {
  const current = text.stages[stage] ?? "";
  return (
    <>
      <aside className="blueprint-hero__rail" aria-hidden="true">
        <ol className="blueprint-hero__rail-list">
          {text.stages.map((name, index) => (
            <li key={name} className={railItemClass(index, stage)}>
              <span className="blueprint-hero__rail-label">{name}</span>
              <span className="blueprint-hero__rail-dot" />
            </li>
          ))}
        </ol>
        <p className="blueprint-hero__rail-current">
          <span className="blueprint-hero__rail-count">
            {padIndex(stage + 1)} / {padIndex(STAGE_COUNT)}
          </span>
          {current}
        </p>
      </aside>
      <p className="blueprint-hero__readout" aria-hidden="true">
        <span>
          {text.stageLabel} {padIndex(stage + 1)} / {padIndex(STAGE_COUNT)}
        </span>
        <span className="blueprint-hero__readout-sep" />
        <span>
          {text.elevationLabel} <span ref={elevationRef}>±0,000</span>
        </span>
      </p>
      <ol className="blueprint-hero__sr-stages" aria-label={text.stageLabel}>
        {text.stages.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ol>
    </>
  );
}
