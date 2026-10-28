"use client";

import { Field } from "@/components/Field";
import type { CalcLocale, CalcT } from "@/lib/calc/text";
import { Segmented, segmentedItemClass } from "@/components/Segmented";
import { SelectField } from "@/components/SelectField";
import type { Currency } from "@/lib/calc/money";
import type { CalcParams, PriceMode } from "@/lib/calc/params";
import type { CalcStock, ResolvedPrice } from "@/lib/calc/priceSource";
import { layoutOptions, unitOptions } from "./priceOptions";

type CalcPriceProps = {
  id: string;
  modes: readonly PriceMode[];
  price: ResolvedPrice;
  stock: CalcStock;
  params: CalcParams;
  /** «Стоимость $84 000», «≈ 991 936 000 сум»; нет стоимости — null. */
  summary: { total: string; approx: string | null } | null;
  onChange: (patch: Partial<CalcParams>) => void;
  t: CalcT;
  locale: CalcLocale;
  /** Заголовок уже над шагом (сайт, «03 Стоимость квартиры») — только для диктора. */
  titleHidden?: boolean;
};

/**
 * Стоимость квартиры (мокап /kalkulyator «03», r1 «Квартира»): режим сегментом, ниже — список
 * свободных квартир, планировок или поля «площадь × цена м²» и «сумма» с валютой ввода (Р7).
 */
export function CalcPrice(props: CalcPriceProps) {
  const { id, modes, price, onChange, t } = props;
  return (
    <section className="calc-price" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className={props.titleHidden ? "sr-only" : "calc-price__title"}>
        {t("price.title")}
      </h3>
      {modes.length > 1 ? (
        <Segmented label={t("price.modesLabel")} form className="calc-price__modes">
          {modes.map((mode) => (
            <button
              key={mode}
              type="button"
              className={segmentedItemClass(mode === price.mode)}
              aria-pressed={mode === price.mode}
              onClick={() => onChange({ mode })}
            >
              {t(`price.modes.${mode}`)}
            </button>
          ))}
        </Segmented>
      ) : null}
      <PriceFields {...props} />
      {props.summary ? (
        <p className="calc-price__summary">
          <span>{t("price.total")}</span>
          <b className="calc-price__total">{props.summary.total}</b>
          {props.summary.approx ? (
            <span className="calc-price__approx">{props.summary.approx}</span>
          ) : null}
        </p>
      ) : (
        <p className="calc-price__empty">{t("price.empty")}</p>
      )}
    </section>
  );
}

function PriceFields(props: CalcPriceProps) {
  const { id, price, stock, onChange, t, locale } = props;
  if (price.mode === "unit") {
    const options = unitOptions(stock, t, locale);
    const free = options.filter((option) => !option.disabled).length;
    return (
      <SelectField
        id={`${id}-unit`}
        label={t("price.unit", { count: free })}
        options={options}
        value={price.unitId ?? ""}
        hint={free === 0 ? t("price.noUnits") : undefined}
        onChange={(event) => onChange({ unit: event.target.value })}
      />
    );
  }
  if (price.mode === "layout") {
    const options = layoutOptions(stock, t, locale);
    return (
      <SelectField
        id={`${id}-layout`}
        label={t("price.layout")}
        options={options}
        value={price.layoutId ?? ""}
        hint={options.every((option) => option.disabled) ? t("price.noLayouts") : undefined}
        onChange={(event) => onChange({ layout: event.target.value })}
      />
    );
  }
  return <AmountFields {...props} />;
}

/** «Площадь × цена м²» и «Сумма»: поля как набраны (в адресе) и валюта ввода $ | сум (Р7). */
function AmountFields({ id, price, params, onChange, t }: CalcPriceProps) {
  const currencyLabel = t(price.currency === "USD" ? "currency.usd" : "currency.uzs");
  return (
    <div className="calc-price__fields">
      {price.mode === "area" ? (
        <>
          <Field
            id={`${id}-area`}
            label={t("price.area")}
            inputMode="decimal"
            value={params.area ?? String(price.areaM2 ?? "")}
            trailing={<span className="calc-price__unit">{t("price.areaUnit")}</span>}
            onChange={(event) => onChange({ area: event.target.value })}
          />
          <Field
            id={`${id}-m2`}
            label={t("price.perM2")}
            inputMode="decimal"
            value={params.perM2 ?? String(price.perM2 ?? "")}
            trailing={
              <span className="calc-price__unit">
                {t("price.perM2Unit", { currency: currencyLabel })}
              </span>
            }
            onChange={(event) => onChange({ perM2: event.target.value })}
          />
        </>
      ) : (
        <Field
          id={`${id}-sum`}
          label={t("price.sum")}
          inputMode="numeric"
          value={params.sum ?? ""}
          onChange={(event) => onChange({ sum: event.target.value })}
        />
      )}
      <CurrencyChoice
        value={price.currency}
        onChange={(inCurrency) => onChange({ inCurrency, perM2: null })}
        t={t}
      />
    </div>
  );
}

type CurrencyChoiceProps = { value: Currency; onChange: (currency: Currency) => void; t: CalcT };

function CurrencyChoice({ value, onChange, t }: CurrencyChoiceProps) {
  return (
    <Segmented label={t("price.currency")} className="calc-price__currency">
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
