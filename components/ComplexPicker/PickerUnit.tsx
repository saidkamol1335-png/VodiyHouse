"use client";

import { Calculator, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Button } from "@/components/Button";
import { loadFlatCalculator, useLayoutCalc } from "@/components/ComplexPlans/useLayoutCalc";
import { LeadButton } from "@/components/LeadDialog";
import type { CalcHints } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { unitPricePerM2 } from "@/lib/calc/unitPrice";
import { formatArea, formatPrice } from "@/lib/format";
import type { Locale } from "@/lib/i18n/routing";
import { getMotionTier } from "@/lib/motion";
import type { PickerUnit as Unit } from "@/lib/site/picker/records";

const FlatCalculator = dynamic(loadFlatCalculator, { ssr: false });

type PickerUnitProps = {
  unit: Unit;
  blockName: string;
  complexSlug: string;
  complexName: string;
  hints: CalcHints;
  leadEnabled: boolean;
  onClose: () => void;
};

/**
 * Свободная квартира, выбранная на плане (мокап .pku): номер, комнаты и площадь, блок и этаж, цена
 * и цена за м²; «Забронировать эту квартиру» — заявка на просмотр с этой квартирой (не бронь в
 * системе); «Рассчитать платёж» — калькулятор квартиры с ней же.
 */
export function PickerUnit({ unit, blockName, complexSlug, complexName, hints, leadEnabled, onClose }: PickerUnitProps) {
  const t = useTranslations("complex.pick");
  const calc = useLayoutCalc();
  const title = useUnitTitle(unit);
  const layoutId = unit.price !== null ? unit.layoutId : null;
  const taken = unit.status !== "free";
  const root = useFocusOnOpen();
  return (
    <section ref={root} className="complex-picker__flat" aria-labelledby={`picked-${unit.id}`}>
      <div className="complex-picker__flat-head">
        <UnitSummary unit={unit} title={title} blockName={blockName} />
        <UnitActions unit={unit} title={title} taken={taken} calc={calc} complexSlug={complexSlug} complexName={complexName} leadEnabled={leadEnabled} onClose={onClose} />
      </div>
      {taken ? (
        <p className="complex-picker__status" role="status">
          {t("takenNow")}
        </p>
      ) : null}
      {layoutId && calc.failed === layoutId ? (
        <p className="complex-picker__status" role="alert">
          {t("calcFailed")}
        </p>
      ) : null}
      {layoutId && calc.open?.layoutId === layoutId ? (
        <div className="complex-picker__calc">
          <FlatCalculator
            key={`${unit.id}-${calc.open.round}`}
            id="complex-picker-calc"
            screen={calc.open.screen}
            initialParams={{ ...readCalcParams({}), mode: "unit", unit: unit.id }}
            lead={leadEnabled ? { complex: complexSlug, layout: layoutId, unit: unit.id } : null}
            onClose={calc.close}
            hints={hints}
          />
        </div>
      ) : null}
    </section>
  );
}

/**
 * Панель появилась — она в поле зрения и с фокусом на заголовке: на телефоне она под планом, вне
 * экрана, а диктор иначе не узнал бы, что квартира открылась.
 */
function useFocusOnOpen() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = root.current;
    node?.scrollIntoView({ behavior: getMotionTier() === "full" ? "smooth" : "auto", block: "nearest" });
    node?.querySelector<HTMLElement>("h3")?.focus({ preventScroll: true });
  }, []);
  return root;
}

/** «Квартира № 41 · 2-комн. · 54,3 м²». */
function useUnitTitle(unit: Unit): string {
  const t = useTranslations("complex.pick");
  const tRooms = useTranslations("complex.rooms");
  const locale = useLocale() as Locale;
  const rooms = unit.rooms === null ? null : unit.rooms <= 4 ? tRooms(String(unit.rooms) as "0") : tRooms("more", { n: unit.rooms });
  return [t("unitTitle", { number: unit.number }), rooms, unit.area !== null ? formatArea(unit.area, locale) : null].filter(Boolean).join(" · ");
}

function UnitSummary({ unit, title, blockName }: { unit: Unit; title: string; blockName: string }) {
  const t = useTranslations("complex.pick");
  const tBlocks = useTranslations("complex.blocks");
  const locale = useLocale() as Locale;
  const perM2 = unitPricePerM2({ price: unit.price, pricePerM2: null }, unit.area);
  return (
    <>
      <div className="complex-picker__flat-title">
        <p className="complex-picker__eyebrow">{t("picked")}</p>
        <h3 id={`picked-${unit.id}`} tabIndex={-1}>
          {title}
        </h3>
        <p>{t("unitSub", { block: tBlocks("block", { name: blockName }), floor: unit.floor })}</p>
      </div>
      <p className="complex-picker__flat-price">
        <b>{unit.price !== null ? formatPrice(unit.price, unit.currency, locale) : t("noPrice")}</b>
        {perM2 !== null ? <small>{t("perM2", { price: formatPrice(perM2, unit.currency, locale) })}</small> : null}
      </p>
    </>
  );
}

type UnitActionsProps = {
  unit: Unit;
  title: string;
  taken: boolean;
  calc: ReturnType<typeof useLayoutCalc>;
  complexSlug: string;
  complexName: string;
  leadEnabled: boolean;
  onClose: () => void;
};

/** «Забронировать эту квартиру» (заявка на просмотр с квартирой), «Рассчитать платёж», «×». */
function UnitActions({ unit, title, taken, calc, complexSlug, complexName, leadEnabled, onClose }: UnitActionsProps) {
  const t = useTranslations("complex.pick");
  const layoutId = unit.price !== null ? unit.layoutId : null;
  return (
    <div className="complex-picker__flat-actions">
      {leadEnabled && !taken ? (
        <LeadButton intent={{ type: "view", object: { complex: complexSlug, unit: unit.id }, context: `${complexName} · ${title}` }}>{t("book")}</LeadButton>
      ) : null}
      {layoutId ? (
        <Button variant="outline" ref={calc.opener(layoutId)} pending={calc.pending === layoutId} onClick={() => calc.toggle(layoutId)}>
          <Calculator size={16} aria-hidden="true" />
          {calc.pending === layoutId ? t("calculating") : t("calculate")}
        </Button>
      ) : null}
      <button type="button" className="complex-picker__close" aria-label={t("close")} onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
