"use client";

import { useLocale, useTranslations } from "next-intl";
import type { CalcLocale } from "@/lib/calc/text";
import { SelectField } from "@/components/SelectField";
import type { CalcParams } from "@/lib/calc/params";
import type { CalcStock, ResolvedPrice } from "@/lib/calc/priceSource";
import { formatPrice } from "@/lib/format";

type FlatUnitsProps = {
  id: string;
  stock: CalcStock;
  price: ResolvedPrice;
  onChange: (patch: Partial<CalcParams>) => void;
};

const priced = (price: number | null): price is number => price !== null && price > 0;

/**
 * Свободные квартиры этой планировки: на 1440 — список «Кв. 8 · 3 эт. · $54 930» (SiteJkCalc1),
 * на телефоне — лента карточек «№ 11 · 4 эт. · $45 480» (MobFlat). Без цены — видна, не выбирается.
 */
export function FlatUnits({ id, stock, price, onChange }: FlatUnitsProps) {
  const t = useTranslations("calc");
  const locale = useLocale() as CalcLocale;
  const currency = stock.blocks[0]?.currency ?? "USD";
  if (price.mode !== "unit" || stock.units.length === 0) return null;
  const free = stock.units.filter((unit) => priced(unit.price)).length;
  const money = (amount: number) => formatPrice(amount, currency, locale);
  return (
    <div className="flat-units">
      <SelectField
        id={`${id}-unit`}
        className="flat-units__select"
        label={t("price.unit", { count: free })}
        value={price.unitId ?? ""}
        options={stock.units.map((unit) => ({
          value: unit.id,
          label: priced(unit.price)
            ? t("flat.unitOption", {
                number: unit.number,
                floor: unit.floor,
                price: money(unit.price),
              })
            : t("flat.unitNoPrice", { number: unit.number, floor: unit.floor }),
          disabled: !priced(unit.price),
        }))}
        onChange={(event) => onChange({ unit: event.target.value })}
      />
      <UnitChips
        id={id}
        units={stock.units}
        value={price.unitId}
        money={money}
        onChange={onChange}
      />
    </div>
  );
}

type UnitChipsProps = {
  id: string;
  units: CalcStock["units"];
  value: string | null;
  money: (amount: number) => string;
  onChange: FlatUnitsProps["onChange"];
};

/** Лента карточек телефона (MobFlat): радиокнопки с подписью «№ 11 · 4 эт. · $45 480». */
function UnitChips({ id, units, value, money, onChange }: UnitChipsProps) {
  const t = useTranslations("calc.flat");
  const free = units.filter((unit) => priced(unit.price)).length;
  return (
    <fieldset className="flat-units__chips">
      <legend className="flat-units__legend">{t("units", { count: free })}</legend>
      <div className="flat-units__row">
        {units.map((unit) => (
          <label key={unit.id} className="flat-units__chip">
            <input
              type="radio"
              className="sr-only"
              name={`${id}-unit-chip`}
              value={unit.id}
              checked={unit.id === value}
              disabled={!priced(unit.price)}
              onChange={() => onChange({ unit: unit.id })}
            />
            <b>{t("unitChip", { number: unit.number })}</b>
            <span>
              {priced(unit.price)
                ? t("unitChipNote", { floor: unit.floor, price: money(unit.price) })
                : t("unitChipNoPrice", { floor: unit.floor })}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
