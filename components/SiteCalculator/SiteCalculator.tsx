"use client";

import { useTranslations } from "next-intl";
import { DeveloperPills } from "@/components/PaymentCalculator/DeveloperPills";
import { PaymentCalculator } from "@/components/PaymentCalculator/PaymentCalculator";
import { SITE_ENGINE } from "@/lib/calc/options";
import { type CalcParams, type PriceMode, writeCalcParams } from "@/lib/calc/params";
import type { CalcHints } from "@/lib/calc/hints";
import type { SiteCalcScreen } from "@/lib/calc/siteScreen";
import { SiteActions, ToTotal } from "./SiteActions";

// Квартиры на /kalkulyator нет: расчёт квартиры получает её цену со страницы ЖК (шаг 2.7).
const MODES: readonly PriceMode[] = ["area", "layout", "sum"];

type SiteCalculatorProps = {
  screen: SiteCalcScreen;
  initialParams: CalcParams;
  /** «Получить точный расчёт» — до заявок фазы 3 только на стенде (решение фазы 2). */
  leadEnabled: boolean;
  /** Тексты «?» из справочника hints (шаг 2.8). */
  hints?: CalcHints;
};

/**
 * /kalkulyator (шаг 2.6, мокап SiteCalc, В6 A): шаги 01–04, итог с лучом в full, график и
 * сравнение; без скидок — движок сайта (PLAN §3.13). Параметры — в адресе: ссылкой можно поделиться.
 */
export function SiteCalculator({ screen, initialParams, leadEnabled, hints }: SiteCalculatorProps) {
  const t = useTranslations("calc");
  const current = screen.current;
  if (!current) return <p className="site-calculator__empty">{t("page.empty")}</p>;
  return (
    <div className="site-calculator">
      <PaymentCalculator
        // Новый адрес с сервера (пример, пилюля застройщика) — расчёт начинается с него заново.
        key={`${current.id}?${writeCalcParams(initialParams)}`}
        id="site-calc"
        engine={SITE_ENGINE}
        data={current.data}
        initialParams={initialParams}
        modes={MODES}
        developerName={current.name}
        actualAt={current.checkedAt}
        layout="steps"
        beam
        hints={hints}
        // Шаг «01 Застройщик» — только когда выбирать есть из кого (иначе пустая карточка).
        header={
          screen.developers.length > 1 ? (
            <DeveloperPills
              label={t("steps.developer")}
              developers={screen.developers}
              value={current.slug}
              rows
            />
          ) : undefined
        }
        renderActions={(snapshot) => (
          <SiteActions
            snapshot={snapshot}
            source={{
              stock: current.data.stock,
              developerName: current.name,
              actualAt: current.checkedAt,
            }}
            lead={leadEnabled ? { developer: current.slug } : null}
          />
        )}
        renderStickyAction={() => <ToTotal />}
      />
    </div>
  );
}
