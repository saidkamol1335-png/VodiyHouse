"use client";

import { type AbstractIntlMessages, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FilterPills } from "@/components/FilterPills";
import type { CalcLocale } from "@/components/PaymentCalculator/calcText";
import {
  PaymentCalculator,
  type CalcSnapshot,
} from "@/components/PaymentCalculator/PaymentCalculator";
import type { ClientCalcScreen } from "@/lib/admin/calc/screen";
import type { CabinetProgram } from "@/lib/calc/cabinet/discounts";
import { CABINET_ENGINE } from "@/lib/calc/cabinet/engine";
import type { CalcParams, PriceMode } from "@/lib/calc/params";
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
    ...cabinetExtras(current.data.options, t),
    decorate: discountDecorator(tDiscount),
  };
  return (
    <div className="client-calculator">
      <PaymentCalculator
        key={current.id}
        id="client-calc"
        engine={CABINET_ENGINE}
        data={current.data}
        initialParams={initialParams}
        modes={MODES}
        developerName={current.name}
        actualAt={current.checkedAt}
        extras={extras}
        header={<DeveloperPills screen={screen} />}
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
    const onCopy = () =>
      control.copy(
        snapshot,
        language,
        telegramMessage(snapshot, input, language, language === "uz" ? uz : ru),
      );
    return (
      <TelegramCopy
        control={control}
        language={language}
        onLanguage={setLanguage}
        onCopy={onCopy}
        compact={compact}
      />
    );
  };
  return { render };
}

/** Застройщик — пилюли (мокап /kalkulyator «01»); смена — новый адрес, данные читает сервер. */
function DeveloperPills({ screen }: { screen: ClientCalcScreen }) {
  const t = useTranslations("admin.calc");
  const router = useRouter();
  const pathname = usePathname();
  if (screen.developers.length < 2 || !screen.current) return null;
  const pills = screen.developers.map((developer) => ({
    key: developer.slug,
    label: developer.name,
  }));
  return (
    <FilterPills
      label={t("developer")}
      pills={pills}
      value={screen.current.slug}
      onChange={(slug) =>
        router.replace(`${pathname}?developer=${encodeURIComponent(slug)}`, { scroll: false })
      }
    />
  );
}
