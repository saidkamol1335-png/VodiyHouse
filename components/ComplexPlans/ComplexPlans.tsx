"use client";

import { Calculator } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Fragment, useRef, useState } from "react";
import type { CalcHints } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { filterLayouts, layoutFilterOptions, type LayoutCard as LayoutCardModel, type LayoutFilter } from "@/lib/site/complex/layouts";
import { DrawingZoom } from "./DrawingZoom";
import { LayoutCard } from "./LayoutCard";
import { LayoutFilters } from "./LayoutFilters";
import { loadFlatCalculator, useLayoutCalc, useLayoutsTarget } from "./useLayoutCalc";
import { useLayoutsView } from "./useLayoutsView";

// Калькулятор — по первому «Рассчитать платёж» (его же useLayoutCalc начинает грузить заранее):
// на телефоне это ~70 КБ JS, которые иначе разбирались бы при каждом открытии страницы ЖК.
const FlatCalculator = dynamic(loadFlatCalculator, { ssr: false });

type ComplexPlansProps = {
  sectionId: string;
  cards: readonly LayoutCardModel[];
  /** Тексты «?» калькулятора из справочника (шаг 2.8). */
  hints: CalcHints;
  /** Адрес ЖК — заявки «Узнать о наличии» и «Получить точный расчёт» знают, о каком ЖК. */
  complexSlug: string;
  /** «ЖК Shodlik» — плашка контекста в окне заявки. */
  complexName: string;
  leadEnabled: boolean;
};

const ALL: LayoutFilter = { blockId: null, rooms: null };
const INITIAL_PARAMS = readCalcParams({});

/**
 * «Планировки» (мокап .plans, ТЗ 7.4): фильтры по блоку и комнатам, карточки, «Рассчитать платёж»
 * открывает расчёт этой квартиры (шаг 2.7) — на 1440 под рядом карточки, на телефоне шторкой.
 */
export function ComplexPlans({ sectionId, cards, hints, complexSlug, complexName, leadEnabled }: ComplexPlansProps) {
  const t = useTranslations("complex.layouts");
  const [filter, setFilter] = useState<LayoutFilter>(ALL);
  const [zoom, setZoom] = useState<LayoutCardModel | null>(null);
  const calc = useLayoutCalc();
  const root = useRef<HTMLDivElement>(null);
  useLayoutsView(root);
  useLayoutsTarget(sectionId, setFilter, (layoutId) => calc.open?.layoutId !== layoutId && calc.calculate(layoutId));
  const options = layoutFilterOptions(cards, filter.blockId);
  const shown = filterLayouts(cards, filter);
  return (
    <div ref={root} className="complex-plans">
      <LayoutFilters options={options} filter={filter} onChange={setFilter} />
      <p className="complex-plans__hint">
        <Calculator size={16} strokeWidth={1.9} aria-hidden />
        {t("hint")}
      </p>
      {shown.length === 0 ? <p className="complex-plans__empty">{t("empty")}</p> : null}
      <div className="complex-plans__grid">
        {shown.map((card) => (
          <Fragment key={card.layout.id}>
            <LayoutCard
              card={card}
              open={calc.open?.layoutId === card.layout.id}
              pending={calc.pending === card.layout.id}
              failed={calc.failed === card.layout.id}
              opener={calc.opener(card.layout.id)}
              onCalculate={() => calc.toggle(card.layout.id)}
              onZoom={() => setZoom(card)}
              ask={{ type: "layout", object: { complex: complexSlug, layout: card.layout.id }, context: complexName }}
            />
            {calc.open?.layoutId === card.layout.id ? (
              <div className="complex-plans__calc">
                <FlatCalculator key={`${card.layout.id}-${calc.open.round}`} id="complex-flat-calc" screen={calc.open.screen} initialParams={INITIAL_PARAMS} lead={leadEnabled ? { complex: complexSlug, layout: card.layout.id } : null} onClose={calc.close} hints={hints} />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
      {zoom ? <DrawingZoom card={zoom} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
