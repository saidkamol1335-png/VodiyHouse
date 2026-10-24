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
  /** Отметка «Условия проверены» застройщика: «актуальны на» — позднее из неё и правки программы (Р5). */
  actualAt: string | null;
  extras?: CalcExtras<P> & { decorate?: DecorateRows };
  /** Выбор застройщика: в кабинете — над калькулятором, на сайте — шаг «01 Застройщик». */
  header?: ReactNode;
  /** card — одна карточка полей (кабинет, мокап r1), steps — шаги 01–04 (сайт, мокап SiteCalc). */
  layout?: "card" | "steps";
  /** Луч по рамке итога (только full) — /kalkulyator (В4 A). */
  beam?: boolean;
  /**
   * page — страница (/kalkulyator); framed — внутри экрана кабинета: поля и итог в янтарной рамке,
   * итог — с нейтральной (В4 A); bare — внутри своей рамки (расчёт квартиры): поля без карточки.
   */
  surface?: "page" | "framed" | "bare";
  /** Шапка над калькулятором из состояния (расчёт квартиры: выбранная квартира и её цена). */
  renderHeader?: (snapshot: CalcSnapshot<P>) => ReactNode;
  /** Своя «Стоимость» вместо режимов (расчёт квартиры: свободные квартиры планировки). */
  renderPrice?: (view: CalcView<P>, update: (patch: Partial<CalcParams>) => void) => ReactNode;
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
    <div className={surfaceClass(props.surface)}>
      {props.renderHeader?.(snapshot)}
      {props.layout === "steps" ? null : props.header}
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
        value={snapshot.total.head?.short ?? null}
        action={props.renderStickyAction?.(snapshot)}
      />
    </div>
  );
}

const surfaceClass = (surface: PaymentCalculatorProps<CalcProgram>["surface"] = "page") =>
  surface === "page" ? "payment-calculator" : `payment-calculator payment-calculator--${surface}`;

type PartProps<P extends CalcProgram> = PaymentCalculatorProps<P> & {
  snapshot: CalcSnapshot<P>;
  update: (patch: Partial<CalcParams>) => void;
  t: CalcT;
};

function ResultPanel<P extends CalcProgram>(props: PartProps<P>) {
  const { snapshot, update, renderActions, t } = props;
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
      beam={props.beam}
      plain={(props.surface ?? "page") !== "page"}
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
        onSelect={(program) => update(pickFromComparison(view, program))}
      />
    </div>
  );
}

/** Строка сравнения выбирает программу с её взносом и сроком — итог совпадает со строкой. */
function pickFromComparison<P extends CalcProgram>(
  view: CalcView<P>,
  id: string,
): Partial<CalcParams> {
  const option = view.options.find((item) => item.id === id);
  const row = view.comparison?.rows.find((item) => item.program === option?.program);
  if (!row) return { program: id, months: null };
  const { downPct, months } = row.calculation;
  return { program: id, downPct, months: months > 0 ? months : null };
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
