"use client";

import { CalcDown } from "@/components/CalcDown";
import { CalcPrice } from "@/components/CalcPrice";
import { CalcPrograms } from "@/components/CalcPrograms";
import { CalcTerm, type CalcTermTexts } from "@/components/CalcTerm";
import type { ExchangeRate } from "@/lib/calc/money";
import type { CalcParams } from "@/lib/calc/params";
import { type CalcProgram, DOWN_MAX_PCT } from "@/lib/calc/programs";
import type { CalcView } from "@/lib/calc/view";
import { formatPercent } from "@/lib/format";
import { type CalcLocale, type CalcT, approxIn, moneyIn, termText } from "./calcText";
import { downChips, programChoices, termButtonsOf, termMessage } from "./inputParts";
import type { PaymentCalculatorProps } from "./PaymentCalculator";

type CalcInputsProps<P extends CalcProgram> = PaymentCalculatorProps<P> & {
  view: CalcView<P>;
  params: CalcParams;
  update: (patch: Partial<CalcParams>) => void;
  t: CalcT;
  locale: CalcLocale;
};

/** «Стоимость $84 000 · ≈ 991 936 000 сум» под полями стоимости. */
function priceSummary<P extends CalcProgram>(
  view: CalcView<P>,
  rate: ExchangeRate | null,
  t: CalcT,
  locale: CalcLocale,
) {
  const { price, currency } = view.price;
  if (price === null) return null;
  const approx = approxIn(price, currency, currency, rate, locale);
  return {
    total: moneyIn(price, currency, currency, null, locale),
    approx: approx === null ? null : t("price.approx", { amount: approx }),
  };
}

/** Левая колонка: стоимость, программа, взнос, срок (у «100% оплаты» взноса и срока нет). */
export function CalcInputs<P extends CalcProgram>(props: CalcInputsProps<P>) {
  const { id, view, params, update, t, locale } = props;
  const choices = programChoices(view, props.data.stock, {
    developerName: props.developerName,
    t,
    locale,
    extras: props.extras ?? {},
  });
  const installment = view.selected && view.selected.program.type !== "full";
  return (
    <div className="payment-calculator__inputs">
      <CalcPrice
        id={`${id}-price`}
        modes={props.modes}
        price={view.price}
        stock={props.data.stock}
        params={params}
        summary={priceSummary(view, props.data.rate, t, locale)}
        onChange={update}
        t={t}
        locale={locale}
      />
      <CalcPrograms
        name={`${id}-program`}
        legend={t("programs.title")}
        choices={choices}
        value={view.selected?.id ?? null}
        onChange={(program) => update({ program })}
        empty={t("programs.empty")}
      />
      {installment ? <DownPart {...props} /> : null}
      {installment ? <TermPart {...props} /> : null}
    </div>
  );
}

function DownPart<P extends CalcProgram>({
  id,
  view,
  update,
  t,
  locale,
  extras,
}: CalcInputsProps<P>) {
  const calc = view.result?.ok ? view.result.calculation : null;
  const pct = formatPercent(view.downPct);
  const rate = view.input?.rate ?? null;
  const amount = calc ? moneyIn(calc.down, calc.currency, view.outCurrency, rate, locale) : null;
  return (
    <CalcDown
      id={`${id}-down`}
      title={t("down.title")}
      minText={t("down.min", { pct: formatPercent(view.minDownPct) })}
      valueText={amount ? t("down.value", { pct, amount }) : pct}
      sliderLabel={t("down.slider")}
      value={view.downPct}
      min={view.minDownPct}
      max={DOWN_MAX_PCT}
      onChange={(downPct) => update({ downPct })}
      chipsTitle={extras?.downTitle ?? t("down.options")}
      chips={downChips(view, update, { t, extras: extras ?? {} })}
    />
  );
}

const termTexts = (t: CalcT): CalcTermTexts => ({
  title: t("term.title"),
  custom: t("term.custom"),
  customNote: t("term.customNote"),
  input: t("term.input"),
  unit: t("term.unit"),
  less: t("term.less"),
  more: t("term.more"),
});

function TermPart<P extends CalcProgram>({ id, view, update, t }: CalcInputsProps<P>) {
  const calc = view.result?.ok ? view.result.calculation : null;
  const term = calc?.term ?? null;
  if (!calc || calc.months === 0) return null;
  const hint =
    view.customMonths && term
      ? t("term.hint", { min: term.min, max: term.max, down: formatPercent(view.downPct) })
      : null;
  return (
    <CalcTerm
      key={view.selected?.id}
      id={`${id}-term`}
      texts={termTexts(t)}
      valueText={termText(calc.months, t)}
      buttons={termButtonsOf(view, t)}
      customHint={hint}
      applied={calc.months}
      requested={view.requestedMonths}
      message={termMessage(term, view.downPct, update, t)}
      onChange={(months) => update({ months })}
    />
  );
}
