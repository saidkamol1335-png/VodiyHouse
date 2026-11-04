"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef } from "react";
import { CalcLead } from "@/components/CalcLead";
import { CalcSchedule } from "@/components/CalcSchedule";
import { CalcStickyBar } from "@/components/CalcStickyBar";
import { CalcTotal, type TotalContext } from "@/components/CalcTotal";
import { HintsContext } from "@/components/Hint";
import { SiteTelegramCopy, ToTotal } from "@/components/SiteCalculator/SiteActions";
import type { Calculation } from "@vh/shared/calc/calculate";
import type { CalcHints } from "@vh/shared/calc/hints";
import type { ExchangeRate } from "@vh/shared/calc/money";
import { firstPaymentMonth } from "@vh/shared/calc/realtor";
import type { CalcLocale, CalcT } from "@vh/shared/calc/text";
import { RealtorBalance, RealtorBreakdown } from "./RealtorCharts";
import { Choice } from "./RealtorFields";
import { RealtorInputs, type Update } from "./RealtorInputs";
import { RealtorTabs, panelId, tabId } from "./RealtorTabs";
import type { RealtorState } from "./realtorState";
import { leadRowsOf, telegramOf } from "./realtorText";
import { type RealtorView, realtorView } from "./realtorView";
import { realtorSearch, useRealtorState } from "./useRealtorState";

type RealtorCalculatorProps = {
  id: string;
  initialState: RealtorState;
  /** Курс ЦБ (или ручной) — переключатели $ | сум; нет курса — только валюта ввода. */
  rate: ExchangeRate | null;
  /** «Получить точный расчёт»; false — кнопки нет. */
  leadEnabled: boolean;
  hints?: CalcHints;
};

/**
 * Риелторский калькулятор /kalkulyator (PLAN §10, п. 48, образец uysot.uz): вкладки «Ипотека ·
 * Рассрочка · Сколько могу купить», условия вводит посетитель; слева поля шагами, справа итог
 * (на широком липкий, с лучом в full), ниже график с датами; на телефоне — полоса «Платёж в месяц».
 */
export function RealtorCalculator({ id, initialState, rate, leadEnabled, hints }: RealtorCalculatorProps) {
  const t = useTranslations("calc");
  const locale = useLocale() as CalcLocale;
  const { state, update } = useRealtorState(initialState);
  const context: TotalContext = { out: rate ? state.outCurrency : state.inCurrency, rate, t, locale };
  const view = realtorView(state, context, rate);
  const totalRef = useRef<HTMLDivElement>(null);
  return (
    <HintsContext.Provider value={hints ?? NO_HINTS}>
      <div className="realtor-calc">
        <RealtorTabs
          id={id}
          label={t("realtor.tabs.label")}
          value={state.tab}
          labels={tabLabels(t)}
          onChange={(tab) => update({ tab })}
        />
        <div className="realtor-calc__main">
          <div
            id={panelId(id)}
            className="realtor-calc__inputs"
            role="tabpanel"
            aria-labelledby={tabId(id, state.tab)}
          >
            {/* Новая вкладка — новые шаги: они входят сдвигом и проявлением (RealtorCalculator.css). */}
            <div key={state.tab} className="realtor-calc__panel">
              <RealtorInputs id={id} state={state} view={view} rate={rate} update={update} t={t} locale={locale} />
            </div>
          </div>
          <div ref={totalRef} className="realtor-calc__result">
            <RealtorResult state={state} view={view} context={context} leadEnabled={leadEnabled} update={update} />
          </div>
        </div>
        {view.calc ? <RealtorFooter calc={view.calc} context={context} /> : null}
        <CalcStickyBar
          watch={totalRef}
          label={view.head?.label ?? t("sticky.monthly")}
          value={view.head?.short ?? null}
          action={<ToTotal />}
        />
      </div>
    </HintsContext.Provider>
  );
}

const NO_HINTS: CalcHints = {};

/** Под калькулятором: остаток долга по периодам и график платежей с датами. */
function RealtorFooter({ calc, context }: { calc: Calculation; context: TotalContext }) {
  return (
    <div className="realtor-calc__footer">
      <RealtorBalance calc={calc} context={context} />
      <CalcSchedule calculation={calc} {...context} firstMonth={firstPaymentMonth(new Date())} />
    </div>
  );
}

const tabLabels = (t: CalcT) => ({
  mortgage: t("realtor.tabs.mortgage"),
  installment: t("realtor.tabs.installment"),
  afford: t("realtor.tabs.afford"),
});

type ActionsProps = {
  state: RealtorState;
  view: RealtorView;
  context: TotalContext;
  leadEnabled: boolean;
};

/** Итог справа: вид расчёта, $ | сум (с курсом), платёж, строки, кнопки, сноски; луч — в full. */
function RealtorResult({ update, ...props }: ActionsProps & { update: Update }) {
  const { state, view, context } = props;
  const { t } = context;
  return (
    <CalcTotal
      eyebrow={view.eyebrow}
      eyebrowHint={state.tab === "installment" ? "installment-markup" : "mortgage"}
      currency={
        context.rate ? (
          <Choice
            label={t("total.currency")}
            className="realtor-calc__out"
            value={state.outCurrency}
            options={[
              { value: "UZS", label: t("currency.uzs") },
              { value: "USD", label: t("currency.usd") },
            ]}
            onChange={(outCurrency) => update({ outCurrency })}
          />
        ) : null
      }
      head={view.head}
      rows={view.rows}
      problem={view.problem}
      actions={view.head ? <Actions {...props} /> : null}
      footnotes={view.footnotes}
      figure={view.calc ? <RealtorBreakdown calc={view.calc} context={context} /> : null}
      lively
      beam
    />
  );
}

/** «Получить точный расчёт» (заявка «Расчёт» со строками) и «Скопировать для Telegram» со ссылкой. */
function Actions({ state, view, context, leadEnabled }: ActionsProps) {
  const link = () => {
    const { origin, pathname, search } = window.location;
    return `${origin}${pathname}?${realtorSearch(search, state)}`;
  };
  return (
    <>
      {leadEnabled && view.head ? (
        <CalcLead
          context={`${view.eyebrow} · ${view.head.value}`}
          rows={leadRowsOf(state, view, context)}
          object={{}}
          calc={null}
        />
      ) : null}
      <SiteTelegramCopy
        message={telegramOf(state, view, context)}
        withLink={() => telegramOf(state, view, context, link())}
      />
    </>
  );
}
