"use client";

import { type AbstractIntlMessages, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { CalcLocale } from "@/components/PaymentCalculator/calcText";
import { DeveloperPills } from "@/components/PaymentCalculator/DeveloperPills";
import {
  PaymentCalculator,
  type CalcSnapshot,
} from "@/components/PaymentCalculator/PaymentCalculator";
import type { ClientCalcScreen } from "@/lib/admin/calc/screen";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { CABINET_ENGINE } from "@/lib/calc/cabinet/engine";
import { type CalcParams, type PriceMode, writeCalcParams } from "@/lib/calc/params";
import { cabinetExtras, discountDecorator } from "./cabinetExtras";
import { telegramMessage, type Translators, uzTranslators } from "./telegramMessage";
import { TelegramCopy } from "./TelegramCopy";
import { type SaveCalculation, useTelegramCopy } from "./useTelegramCopy";

const MODES: readonly PriceMode[] = ["unit", "area", "layout", "sum"];

type Current = NonNullable<ClientCalcScreen["current"]>;

type ClientCalculatorProps = {
  screen: ClientCalcScreen;
  initialParams: CalcParams;
  /** calc и admin.calcTelegram на узбекском — для текста клиенту (кабинет — на русском). */
  uzMessages: AbstractIntlMessages;
  save: SaveCalculation;
};

/**
 * «Расчёт для клиента» (Р1, шаг 2.5): общий калькулятор со скидками кабинета — застройщик,
 * квартира из наличия (или площадь, планировка, сумма), программа, взнос, срок; итог копируется
 * для Telegram на языке клиента и сохраняется снимком.
 */
export function ClientCalculator({
  screen,
  initialParams,
  uzMessages,
  save,
}: ClientCalculatorProps) {
  const t = useTranslations("admin.calc");
  const tDiscount = useTranslations("admin.calcTelegram");
  const telegram = useTelegram(screen.current, uzMessages, save);
  const current = screen.current;
  if (!current) return <p className="client-calculator__empty">{t("noDevelopers")}</p>;
  const extras = {
    ...cabinetExtras(t),
    decorate: discountDecorator(tDiscount),
  };
  return (
    <div className="client-calculator">
      <PaymentCalculator
        // Новый адрес с сервера (пример, пилюля застройщика) — расчёт начинается с него заново.
        key={`${current.id}?${writeCalcParams(initialParams)}`}
        id="client-calc"
        surface="framed"
        engine={CABINET_ENGINE}
        data={current.data}
        initialParams={initialParams}
        modes={MODES}
        developerName={current.name}
        actualAt={current.checkedAt}
        extras={extras}
        header={
          <DeveloperPills
            label={t("developer")}
            developers={screen.developers}
            value={current.slug}
          />
        }
        renderActions={(snapshot) => telegram.render(snapshot, false)}
        renderStickyAction={(snapshot) => telegram.render(snapshot, true)}
      />
    </div>
  );
}

/** Кнопка Telegram в итоге и в липкой полосе: один язык и один ответ на обе. */
function useTelegram(
  current: Current | null,
  uzMessages: AbstractIntlMessages,
  save: SaveCalculation,
) {
  const tCalc = useTranslations("calc");
  const tDiscount = useTranslations("admin.calcTelegram");
  const [language, setLanguage] = useState<CalcLocale>("ru");
  const uz = useMemo(() => uzTranslators(uzMessages), [uzMessages]);
  const control = useTelegramCopy(save);
  const ru: Translators = { calc: tCalc, discount: tDiscount };
  const render = (snapshot: CalcSnapshot<CabinetProgram>, compact: boolean) => {
    if (!current) return null;
    const input = {
      stock: current.data.stock,
      developerName: current.name,
      actualAt: current.checkedAt,
    };
    const message = telegramMessage(snapshot, input, language, language === "uz" ? uz : ru);
    return (
      <TelegramCopy
        control={control}
        language={language}
        onLanguage={setLanguage}
        message={message}
        onCopy={() => control.copy(snapshot, language, message)}
        compact={compact}
      />
    );
  };
  return { render };
}
