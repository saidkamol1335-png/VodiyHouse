"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useRef } from "react";
import { CalcCompare } from "@/components/CalcCompare";
import { CalcSchedule } from "@/components/CalcSchedule";
import { CalcStickyBar } from "@/components/CalcStickyBar";
import { CalcTotal, type TotalContext } from "@/components/CalcTotal";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import type { Currency } from "@/lib/calc/money";
import type { CalcEngine } from "@/lib/calc/options";
import type { CalcParams, PriceMode } from "@/lib/calc/params";
import type { CalcProgram } from "@/lib/calc/programs";
import { type CalcData, type CalcView, calculatorView } from "@/lib/calc/view";
import { CalcInputs } from "./CalcInputs";
import type { CalcExtras } from "./inputParts";
import {
  type CalcTotalView,
  compareRows,
  compareTexts,
  type DecorateRows,
  footnotes,
  totalView,
} from "./outputParts";
import type { CalcLocale, CalcT } from "./calcText";
import { useCalcParams } from "./useCalcParams";

/** Что видят кнопки итога: расчёт, его строки и сноски — для текста Telegram и снимка. */
export type CalcSnapshot<P extends CalcProgram> = {
  view: CalcView<P>;
  total: CalcTotalView;
  footnotes: string[];
  params: CalcParams;
  context: TotalContext;
};

export type PaymentCalculatorProps<P extends CalcProgram> = {
  id: string;
  engine: CalcEngine<P>;
  data: CalcData<P>;
  initialParams: CalcParams;
  modes: readonly PriceMode[];
  developerName: string;
  /** «Условия актуальны на» — позднее из правки программ и отметки «проверены» (Р5). */
  actualAt: string | null;
  extras?: CalcExtras<P> & { decorate?: DecorateRows };
  /** Над калькулятором — выбор застройщика (кабинет). */
  header?: ReactNode;
  renderActions?: (snapshot: CalcSnapshot<P>) => ReactNode;
  renderStickyAction?: (snapshot: CalcSnapshot<P>) => ReactNode;
};

/**
 * Калькулятор платежа — один компонент на кабинет («Расчёт для клиента»), /kalkulyator и расчёт
 * квартиры (Р9, В4–В9): слева стоимость, программа, взнос и срок; справа итог (на 1440 липкий);
 * ниже график и сравнение; на телефоне — липкая полоса «Платёж в месяц».
 */
export function PaymentCalculator<P extends CalcProgram>(props: PaymentCalculatorProps<P>) {
  const t = useTranslations("calc");
  const locale = useLocale() as CalcLocale;
  const { params, update } = useCalcParams(props.initialParams);
  const view = calculatorView(props.engine, props.data, params, props.modes.includes("unit"));
  const context: TotalContext = { out: view.outCurrency, rate: props.data.rate, t, locale };
  const snapshot: CalcSnapshot<P> = {
    view,
    total: totalView(view, context, props.extras?.decorate),
    footnotes: footnotes(view, { t, rate: props.data.rate, actualAt: props.actualAt }),
    params,
    context,
  };
  const totalRef = useRef<HTMLDivElement>(null);
  return (
    <div className="payment-calculator">
      {props.header}
      <div className="payment-calculator__main">
        <CalcInputs {...props} view={view} params={params} update={update} t={t} locale={locale} />
        <div ref={totalRef} className="payment-calculator__result">
          <ResultPanel {...props} snapshot={snapshot} update={update} t={t} />
        </div>
      </div>
      <CalcFooter {...props} snapshot={snapshot} update={update} t={t} />
      <CalcStickyBar
        watch={totalRef}
        label={snapshot.total.head?.label ?? t("sticky.monthly")}
        value={snapshot.total.head?.value ?? null}
        action={props.renderStickyAction?.(snapshot)}
      />
    </div>
  );
}

type PartProps<P extends CalcProgram> = PaymentCalculatorProps<P> & {
  snapshot: CalcSnapshot<P>;
  update: (patch: Partial<CalcParams>) => void;
  t: CalcT;
};

function ResultPanel<P extends CalcProgram>({ snapshot, update, renderActions, t }: PartProps<P>) {
  const { view, total } = snapshot;
  const currency = snapshot.context.rate ? (
    <OutCurrency
      value={view.outCurrency}
      onChange={(outCurrency) => update({ outCurrency })}
      t={t}
    />
  ) : null;
  return (
    <CalcTotal
      eyebrow={total.eyebrow}
      currency={currency}
      head={total.head}
      rows={total.rows}
      problem={total.problem}
      actions={total.head ? renderActions?.(snapshot) : null}
      footnotes={snapshot.footnotes}
    />
  );
}

function CalcFooter<P extends CalcProgram>({ snapshot, update, t }: PartProps<P>) {
  const { view, context } = snapshot;
  const calc = view.result?.ok ? view.result.calculation : null;
  const compared = compareRows(view, context);
  return (
    <div className="payment-calculator__footer">
      {calc ? (
        <CalcSchedule
          calculation={calc}
          out={context.out}
          rate={context.rate}
          t={t}
          locale={context.locale}
        />
      ) : null}
      <CalcCompare
        title={view.price.mode === "unit" ? t("compare.titleUnit") : t("compare.title")}
        rows={compared.rows}
        texts={compareTexts(t)}
        note={compared.note}
        onSelect={(program) => update({ program })}
      />
    </div>
  );
}

type OutCurrencyProps = { value: Currency; onChange: (currency: Currency) => void; t: CalcT };

/** $ | сум в итоге (В9 B): выбор клиента сохраняется при смене программы и попадает в адрес. */
function OutCurrency({ value, onChange, t }: OutCurrencyProps) {
  return (
    <Segmented label={t("total.currency")} className="payment-calculator__currency">
      {(["USD", "UZS"] as const).map((currency) => (
        <button
          key={currency}
          type="button"
          className={segmentedItemClass(currency === value)}
          aria-pressed={currency === value}
          onClick={() => onChange(currency)}
        >
          {t(currency === "USD" ? "currency.usd" : "currency.uzs")}
        </button>
      ))}
    </Segmented>
  );
}
