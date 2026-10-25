"use client";

import { Calculator } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { FlatCalculator } from "@/components/FlatCalculator";
import { flatCalcFrom, type FlatCalcScreen } from "@/lib/calc/flatScreen";
import type { CalcHints } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { getMotionTier } from "@/lib/motion";
import { readLayoutCalcAction } from "@/lib/site/complex/actions";
import { filterLayouts, layoutFilterOptions, type LayoutCard as LayoutCardModel, type LayoutFilter } from "@/lib/site/complex/layouts";
import { parseLayoutsLink } from "@/lib/site/complex/layoutsLink";
import { DrawingZoom } from "./DrawingZoom";
import { LayoutCard } from "./LayoutCard";
import { LayoutFilters } from "./LayoutFilters";

type ComplexPlansProps = {
  sectionId: string;
  cards: readonly LayoutCardModel[];
  /** Тексты «?» калькулятора из справочника (шаг 2.8). */
  hints: CalcHints;
  leadEnabled: boolean;
};

const ALL: LayoutFilter = { blockId: null, rooms: null };
const INITIAL_PARAMS = readCalcParams({});

/** Фильтр из якоря «#planirovki?blok=…»: ссылки «Рассчитать платёж» блока и строк «Наличия». */
function useLinkedFilter(sectionId: string, setFilter: (filter: LayoutFilter) => void) {
  useEffect(() => {
    const apply = () => {
      const filter = parseLayoutsLink(window.location.hash);
      if (!filter || (filter.blockId === null && filter.rooms === null)) return;
      setFilter(filter);
      history.replaceState(null, "", `#${sectionId}`);
      document.getElementById(sectionId)?.scrollIntoView({ behavior: getMotionTier() === "full" ? "smooth" : "auto" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [sectionId, setFilter]);
}

type OpenCalc = { layoutId: string; screen: FlatCalcScreen; round: number };

/**
 * Расчёт планировки: данные — по нажатию (site_layout_calc), ошибка — у кнопки этой планировки;
 * закрыли — фокус на «Рассчитать платёж» той планировки, расчёт которой закрыли.
 */
function useLayoutCalc() {
  const [open, setOpen] = useState<OpenCalc | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const openers = useRef(new Map<string, HTMLButtonElement>());
  const calculate = (layoutId: string) => {
    setPending(layoutId);
    setFailed(null);
    startTransition(async () => {
      const record = await readLayoutCalcAction(layoutId);
      setPending(null);
      if (!record) return setFailed(layoutId);
      setOpen((current) => ({
        layoutId,
        screen: flatCalcFrom(record),
        round: (current?.round ?? 0) + 1,
      }));
    });
  };
  const close = () => {
    if (open) openers.current.get(open.layoutId)?.focus();
    setOpen(null);
  };
  const opener = (layoutId: string) => (node: HTMLButtonElement | null) => {
    if (node) openers.current.set(layoutId, node);
    else openers.current.delete(layoutId);
  };
  return { open, pending, failed, calculate, close, opener };
}

/**
 * «Планировки» (мокап .plans, ТЗ 7.4): фильтры по блоку и комнатам, карточки, «Рассчитать платёж»
 * открывает расчёт этой квартиры (шаг 2.7) — на 1440 под рядом карточки, на телефоне шторкой.
 */
export function ComplexPlans({ sectionId, cards, hints, leadEnabled }: ComplexPlansProps) {
  const t = useTranslations("complex.layouts");
  const [filter, setFilter] = useState<LayoutFilter>(ALL);
  const [zoom, setZoom] = useState<LayoutCardModel | null>(null);
  const calc = useLayoutCalc();
  useLinkedFilter(sectionId, setFilter);
  const options = layoutFilterOptions(cards, filter.blockId);
  const shown = filterLayouts(cards, filter);
  return (
    <div className="complex-plans">
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
              onCalculate={() => calc.calculate(card.layout.id)}
              onZoom={() => setZoom(card)}
            />
            {calc.open?.layoutId === card.layout.id ? (
              <div className="complex-plans__calc">
                <FlatCalculator key={`${card.layout.id}-${calc.open.round}`} id="complex-flat-calc" screen={calc.open.screen} initialParams={INITIAL_PARAMS} leadEnabled={leadEnabled} onClose={calc.close} hints={hints} />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
      {zoom ? <DrawingZoom card={zoom} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
