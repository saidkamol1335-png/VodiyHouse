"use client";

import { useTranslations } from "next-intl";
import { type ReactNode, useRef, useState } from "react";
import { ComplexSection } from "@/components/ComplexSection";
import type { CalcHints } from "@/lib/calc/hints";
import { formatTime } from "@/lib/format";
import type { ComplexPicker as PickerData } from "@/lib/site/picker/records";
import { PickerFacade, type FacadeLight } from "./PickerFacade";
import { PickerPlan } from "./PickerPlan";
import { PickerUnit } from "./PickerUnit";
import { usePickerChoice, type PickerChoice } from "./usePickerChoice";
import { usePickerUnits } from "./usePickerUnits";

export type PickerBlockView = {
  id: string;
  name: string;
  buildStatus: "building" | "delivered";
  progressPct: number | null;
};

type ComplexPickerProps = {
  id: string;
  title: ReactNode;
  lead: ReactNode;
  picker: PickerData;
  blocks: PickerBlockView[];
  complexSlug: string;
  complexName: string;
  hints: CalcHints;
  leadEnabled: boolean;
};

/**
 * «Выбрать квартиру» (фаза 4, мокап SiteJkPick / MobJkFacade / MobJkFloor): фасад → этажи блока →
 * план этажа (подъезд — переключателем) → свободная квартира с ценой, расчётом и «Забронировать»
 * (заявка, не бронь в системе). Клиенту видны только «свободна / бронь / продана».
 */
export function ComplexPicker({ id, title, lead, picker, blocks, complexSlug, complexName, hints, leadEnabled }: ComplexPickerProps) {
  const t = useTranslations("complex.pick");
  const section = useRef<HTMLDivElement>(null);
  const [light, setLight] = useState<FacadeLight>("day");
  const shown = blocks.filter((block) => picker.blocks.some((item) => item.id === block.id));
  const units = usePickerUnits(shown.map((block) => block.id), section);
  const choice = usePickerChoice(picker, units.byBlock);
  const block = shown.find((item) => item.id === choice.blockId) ?? null;
  const { lastBlock, back, closeUnit } = useReturnFocus(choice, section);
  return (
    <ComplexSection id={id} title={title} lead={lead} stamp={units.updatedAt ? t("live", { time: formatTime(units.updatedAt) }) : null}>
      <div ref={section} className="complex-picker">
        <div className="complex-picker__frame">
          {block ? (
            <PickerPlan block={block} choice={{ ...choice, back }} failed={units.failed} onRetry={units.retry} />
          ) : (
            <PickerFacade
              facade={picker.facade}
              contours={picker.blocks}
              blocks={shown}
              units={units.byBlock}
              light={light}
              onLight={setLight}
              onPick={choice.pickBlock}
              focusBlock={lastBlock}
              alt={complexName}
            />
          )}
        </div>
        {block && choice.unit ? (
          <PickerUnit
            key={choice.unit.id}
            unit={choice.unit}
            blockName={block.name}
            complexSlug={complexSlug}
            complexName={complexName}
            hints={hints}
            leadEnabled={leadEnabled}
            onClose={closeUnit}
          />
        ) : null}
      </div>
    </ComplexSection>
  );
}

/** Фокус с клавиатуры не теряется: «Все корпуса» возвращает его на блок, закрытие панели — на квартиру. */
function useReturnFocus(choice: PickerChoice, section: React.RefObject<HTMLDivElement | null>) {
  const [lastBlock, setLastBlock] = useState<string | null>(null);
  const back = () => {
    setLastBlock(choice.blockId);
    choice.back();
  };
  const closeUnit = () => {
    const unitId = choice.unit?.id;
    choice.pickUnit(null);
    if (unitId) requestAnimationFrame(() => section.current?.querySelector<HTMLElement>(`[data-unit-id="${unitId}"]`)?.focus());
  };
  return { lastBlock, back, closeUnit };
}
