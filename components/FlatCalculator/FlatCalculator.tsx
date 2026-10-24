"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import type { CalcLocale } from "@/components/PaymentCalculator/calcText";
import { PaymentCalculator } from "@/components/PaymentCalculator/PaymentCalculator";
import { SiteActions, ToTotal } from "@/components/SiteCalculator/SiteActions";
import type { FlatCalcScreen } from "@/lib/calc/flatScreen";
import { SITE_ENGINE } from "@/lib/calc/options";
import { type CalcParams, writeCalcParams } from "@/lib/calc/params";
import { FlatHead } from "./FlatHead";
import { FlatUnits } from "./FlatUnits";

const sourceOf = (screen: FlatCalcScreen) => ({
  stock: screen.data.stock,
  developerName: screen.developerName,
  actualAt: screen.checkedAt,
});

// Шторка — только на телефоне (MobFlat); шире — панель на месте, под карточкой планировки.
const PHONE = "(max-width: 767px)";

type FlatCalculatorProps = {
  id: string;
  screen: FlatCalcScreen;
  initialParams: CalcParams;
  /** «Получить точный расчёт» — до заявок фазы 3 только на стенде (решение фазы 2). */
  leadEnabled: boolean;
  onClose: () => void;
};

/**
 * Открыть при появлении: на телефоне — модальной шторкой, шире — на месте страницы. Фокус — на
 * заголовок «3-комн. · 78 м²» (диктор читает, что открылось), а не на «Закрыть» с кольцом фокуса.
 */
function useOpenDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    if (window.matchMedia(PHONE).matches) element.showModal();
    else element.show();
    element.querySelector<HTMLElement>(".flat-calc__title")?.focus();
  }, []);
  return dialog;
}

/**
 * «Расчёт для этой квартиры» (шаг 2.7, мокапы SiteJkCalc1, MobFlat*, В4 A, Р9): тот же
 * калькулятор, что /kalkulyator, без скидок; стоимость — свободные квартиры планировки. Один
 * <dialog>: на телефоне — модальная шторка, шире — открыт на месте (show), без затемнения.
 */
export function FlatCalculator({
  id,
  screen,
  initialParams,
  leadEnabled,
  onClose,
}: FlatCalculatorProps) {
  const locale = useLocale() as CalcLocale;
  const dialog = useOpenDialog();
  const close = () => dialog.current?.close();
  return (
    <dialog ref={dialog} className="flat-calc" aria-labelledby={`${id}-title`} onClose={onClose}>
      <PaymentCalculator
        key={`${screen.layout.id}?${writeCalcParams(initialParams)}`}
        id={id}
        engine={SITE_ENGINE}
        data={screen.data}
        initialParams={initialParams}
        modes={screen.modes}
        developerName={screen.developerName}
        actualAt={screen.checkedAt}
        surface="bare"
        renderHeader={({ view }) => (
          <FlatHead id={id} screen={screen} view={view} locale={locale} onClose={close} />
        )}
        renderPrice={(view, update) => (
          <FlatUnits
            id={id}
            stock={screen.data.stock}
            price={view.price}
            locale={locale}
            onChange={update}
          />
        )}
        renderActions={(snapshot) => (
          <SiteActions snapshot={snapshot} source={sourceOf(screen)} leadEnabled={leadEnabled} />
        )}
        renderStickyAction={() => <ToTotal scope={dialog} />}
      />
    </dialog>
  );
}
