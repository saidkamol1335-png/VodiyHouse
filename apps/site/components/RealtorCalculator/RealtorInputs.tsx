"use client";

import { CalcStep } from "@/components/CalcStep";
import type { CalcLocale, CalcT } from "@vh/shared/calc/text";
import type { ExchangeRate } from "@vh/shared/calc/money";
import { REALTOR_LIMITS, downForPct } from "@vh/shared/calc/realtor";
import { formatAmount, formatPercent, formatPrice } from "@vh/shared/format";
import { Choice, Chips, NumberField } from "./RealtorFields";
import { MarkupField, RateFields, TermFields } from "./RealtorTerm";
import { type RealtorState, parseAmount, switchCurrency } from "./realtorState";
import { type RealtorView, inputOf, priceOf } from "./realtorView";

/** Взнос по кнопке от цены: остальной ввод downForPct не читает. */
const REALTOR_INPUT_STUB = { mode: "mortgage", monthly: 0, ratePct: 0, months: 1, method: "annuity" } as const;

export type Update = (patch: Partial<RealtorState> | ((state: RealtorState) => RealtorState)) => void;

export type RealtorInputsProps = {
  id: string;
  state: RealtorState;
  view: RealtorView;
  rate: ExchangeRate | null;
  update: Update;
  t: CalcT;
  locale: CalcLocale;
};

/**
 * Поля вкладки шагами 01–03 (вид мокапа SiteCalc): стоимость или платёж в месяц, взнос, срок со
 * ставкой (у рассрочки — с наценкой). Всё вводит посетитель — программ застройщика здесь нет.
 */
export function RealtorInputs(props: RealtorInputsProps) {
  const { id, state, t } = props;
  return (
    <>
      {state.tab === "afford" ? (
        <CalcStep id={`${id}-monthly`} number={1} title={t("realtor.steps.monthly")}>
          <MonthlyFields {...props} />
        </CalcStep>
      ) : (
        <CalcStep id={`${id}-price`} number={1} title={t("realtor.steps.price")}>
          <PriceFields {...props} />
        </CalcStep>
      )}
      <CalcStep id={`${id}-down`} number={2} title={t("realtor.steps.down")}>
        <DownFields {...props} />
      </CalcStep>
      <CalcStep
        id={`${id}-term`}
        number={3}
        title={t(state.tab === "installment" ? "realtor.steps.termInstallment" : "realtor.steps.term")}
      >
        <TermFields {...props} />
        {state.tab === "installment" ? <MarkupField {...props} /> : <RateFields {...props} />}
      </CalcStep>
    </>
  );
}

export const currencyLabel = (state: RealtorState, t: CalcT) =>
  t(state.inCurrency === "USD" ? "currency.usd" : "currency.uzs");

/** $ | сум ввода — только с курсом: суммы в полях пересчитываются по нему. */
function InCurrency({ state, rate, update, t }: RealtorInputsProps) {
  if (!rate) return null;
  return (
    <Choice
      label={t("price.currency")}
      className="realtor-calc__currency"
      value={state.inCurrency}
      options={[
        { value: "UZS", label: t("currency.uzs") },
        { value: "USD", label: t("currency.usd") },
      ]}
      onChange={(currency) => update((current) => switchCurrency(current, currency, rate))}
    />
  );
}

function PriceFields(props: RealtorInputsProps) {
  const { id, state, update, t, locale } = props;
  const unit = currencyLabel(state, t);
  const price = priceOf(state);
  return (
    <div className="realtor-calc__group">
      <Choice
        form
        label={t("realtor.price.modesLabel")}
        value={state.priceMode}
        options={[
          { value: "sum", label: t("price.modes.sum") },
          { value: "area", label: t("price.modes.area") },
        ]}
        onChange={(priceMode) => update({ priceMode })}
      />
      <div className="realtor-calc__row">
        {state.priceMode === "sum" ? (
          <NumberField
            id={`${id}-sum`}
            label={t("price.sum")}
            unit={unit}
            value={state.sum}
            onChange={(sum) => update({ sum })}
          />
        ) : (
          <AreaFields {...props} />
        )}
        <InCurrency {...props} />
      </div>
      {state.priceMode === "area" && price !== null && price > 0 ? (
        <p className="realtor-calc__summary">
          <span>{t("price.total")}</span>
          <b>{formatPrice(price, state.inCurrency, locale)}</b>
        </p>
      ) : null}
    </div>
  );
}

/** «Площадь × цена м²»: цена м² — в валюте ввода. */
function AreaFields({ id, state, update, t }: RealtorInputsProps) {
  return (
    <>
      <NumberField
        id={`${id}-area`}
        label={t("price.area")}
        unit={t("price.areaUnit")}
        decimal
        value={state.area}
        onChange={(area) => update({ area })}
      />
      <NumberField
        id={`${id}-m2`}
        label={t("price.perM2")}
        unit={t("price.perM2Unit", { currency: currencyLabel(state, t) })}
        value={state.perM2}
        onChange={(perM2) => update({ perM2 })}
      />
    </>
  );
}

function MonthlyFields(props: RealtorInputsProps) {
  const { id, state, update, t } = props;
  return (
    <div className="realtor-calc__row">
      <NumberField
        id={`${id}-monthly-sum`}
        label={t("realtor.monthly.label")}
        unit={currencyLabel(state, t)}
        hint={t("realtor.monthly.hint")}
        value={state.monthly}
        onChange={(monthly) => update({ monthly })}
      />
      <InCurrency {...props} />
    </div>
  );
}

/** Взнос суммой (как у uysot) и кнопки 10–40 %: от цены, у «Сколько могу купить» — от будущей цены. */
function DownFields({ id, state, view, update, t }: RealtorInputsProps) {
  const pct = view.calc ? view.calc.downPct : null;
  // Ипотеке и рассрочке хватает цены (ставку могли ещё не ввести); подбору по платежу нужен весь ввод.
  const pick = (share: number) => {
    const input = inputOf(state);
    const price = priceOf(state) ?? 0;
    if (state.tab !== "afford" && price > 0) {
      return update({ first: formatAmount(Math.round(downForPct(share, { ...REALTOR_INPUT_STUB, price }))) });
    }
    if (typeof input !== "string") update({ first: formatAmount(Math.round(downForPct(share, input))) });
  };
  const chips = REALTOR_LIMITS.downPresets.map((share) => ({
    key: String(share),
    label: `${share} %`,
    active: pct !== null && Math.abs(pct - share) < 0.05,
    onPick: () => pick(share),
  }));
  const share = pct !== null && parseAmount(state.first) ? t("realtor.down.share", { pct: formatPercent(Math.round(pct * 10) / 10) }) : undefined;
  return (
    <div className="realtor-calc__group">
      <NumberField
        id={`${id}-first`}
        label={t("realtor.down.label")}
        unit={currencyLabel(state, t)}
        value={state.first}
        hint={view.capped ? undefined : share}
        error={view.capped ? t("realtor.down.capped") : undefined}
        onChange={(first) => update({ first })}
      />
      <Chips label={t("realtor.down.presets")} chips={chips} />
    </div>
  );
}
