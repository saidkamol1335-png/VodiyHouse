"use client";

import { Calculator } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { loadFlatCalculator } from "@/components/ComplexPlans/useLayoutCalc";
import type { CalcHints } from "@/lib/calc/hints";
import { readCalcParams } from "@/lib/calc/params";
import { flatCalcFrom, type FlatCalcScreen } from "@/lib/calc/flatScreen";
import { readLayoutCalcWithoutUnitsAction } from "@/lib/site/complex/actions";

const FlatCalculator = dynamic(loadFlatCalculator, { ssr: false });
const INITIAL_PARAMS = readCalcParams({});

type UnitVideoCalcProps = {
  layoutId: string;
  complexSlug: string;
  hints: CalcHints;
  leadEnabled: boolean;
};

/**
 * «Сколько платить за эту квартиру» (мокап SiteVideo .pcalc, MobVideo .vcalc): калькулятор планировки
 * той же кнопкой и тем же чанком, что на странице ЖК. Без списка квартир (его убирает сервер) — номер
 * квартиры клиенту не показываем (PLAN фазы 5): расчёт по «цене от» планировки (вопрос заказчику — PROGRESS).
 */
export function UnitVideoCalc({ layoutId, complexSlug, hints, leadEnabled }: UnitVideoCalcProps) {
  const t = useTranslations("unitVideo");
  const [screen, setScreen] = useState<FlatCalcScreen | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const opener = useRef<HTMLButtonElement>(null);
  const open = () =>
    startTransition(async () => {
      setFailed(false);
      const [record] = await Promise.all([
        readLayoutCalcWithoutUnitsAction(layoutId),
        loadFlatCalculator(),
      ]).catch(() => [null]);
      if (!record) return setFailed(true);
      setScreen(flatCalcFrom(record));
    });
  const close = () => {
    setScreen(null);
    opener.current?.focus();
  };
  return (
    <div className="unit-video__calc">
      {screen ? (
        <FlatCalculator
          id="unit-video-calc"
          screen={screen}
          initialParams={INITIAL_PARAMS}
          lead={leadEnabled ? { complex: complexSlug, layout: layoutId } : null}
          onClose={close}
          hints={hints}
        />
      ) : (
        <Button ref={opener} variant="primary" pending={pending} onClick={open}>
          <Calculator size={18} aria-hidden="true" />
          {pending ? t("calcPending") : t("calcButton")}
        </Button>
      )}
      {failed ? (
        <p className="unit-video__calc-error" role="alert">
          {t("calcFailed")}
        </p>
      ) : null}
    </div>
  );
}
