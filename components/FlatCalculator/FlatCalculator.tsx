"use client";

import { useLocale } from "next-intl";
import { type KeyboardEvent, type RefObject, type SyntheticEvent, useEffect, useRef } from "react";
import type { CalcLocale } from "@/components/PaymentCalculator/calcText";
import { PaymentCalculator } from "@/components/PaymentCalculator/PaymentCalculator";
import { SiteActions, ToTotal } from "@/components/SiteCalculator/SiteActions";
import type { FlatCalcScreen } from "@/lib/calc/flatScreen";
import type { CalcHints } from "@/lib/calc/hints";
import { SITE_ENGINE } from "@/lib/calc/options";
import type { LeadObject } from "@/lib/leads/types";
import { type CalcParams, writeCalcParams } from "@/lib/calc/params";
import { FlatHead } from "./FlatHead";
import { FlatUnits } from "./FlatUnits";

/** Окно заявки — портал, но его close всплывает по дереву React сюда: реагируем только на своё. */
const ownClose = (onClose: () => void) => (event: SyntheticEvent<HTMLDialogElement>) => {
  if (event.target === event.currentTarget) onClose();
};

/** Шторку Escape закрывает сам браузер; панель на месте (show) — нет: закрываем её так же. */
function closeOnEscape(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Escape" || event.currentTarget.matches(":modal")) return;
  // Нажатие пришло из окна заявки (портал — но по дереву React всплывает сюда): это его Escape.
  if ((event.target as Element).closest("dialog") !== event.currentTarget) return;
  event.preventDefault();
  event.currentTarget.close();
}

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
  /** ЖК и планировка заявки «Получить точный расчёт»; null — кнопки нет. */
  lead: LeadObject | null;
  onClose: () => void;
  /** Тексты «?» из справочника hints (шаг 2.8). */
  hints?: CalcHints;
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
  useBarHeight(dialog);
  return dialog;
}

/** Высота липкой строки шторки — в CSS-переменную окна: итог и поля встают под строку. */
function useBarHeight(dialog: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const element = dialog.current;
    const bar = element?.querySelector<HTMLElement>(".flat-calc__bar");
    if (!element || !bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      element.style.setProperty("--flat-calc-bar-h", `${Math.ceil(bar.offsetHeight)}px`),
    );
    observer.observe(bar);
    return () => observer.disconnect();
  }, [dialog]);
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
  lead,
  onClose,
  hints,
}: FlatCalculatorProps) {
  const locale = useLocale() as CalcLocale;
  const dialog = useOpenDialog();
  const close = () => dialog.current?.close();
  return (
    <dialog
      ref={dialog}
      className="flat-calc"
      aria-labelledby={`${id}-title`}
      onClose={ownClose(onClose)}
      onKeyDown={closeOnEscape}
    >
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
        hints={hints}
        renderHeader={({ view }) => (
          <FlatHead id={id} screen={screen} view={view} locale={locale} onClose={close} />
        )}
        renderPrice={(view, update) => (
          <FlatUnits id={id} stock={screen.data.stock} price={view.price} onChange={update} />
        )}
        renderActions={(snapshot) => (
          <SiteActions snapshot={snapshot} source={sourceOf(screen)} lead={lead} />
        )}
        renderStickyAction={() => <ToTotal scope={dialog} />}
      />
    </dialog>
  );
}
