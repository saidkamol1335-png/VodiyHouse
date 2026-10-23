"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import {
  isPriceIssue,
  priceExample,
  priceMax,
  readPriceDraft,
  type PriceDraft,
  type PriceIssue,
} from "@/lib/admin/units/priceForm";
import type { PriceMode, UnitsBlock } from "@/lib/admin/units/types";
import { formatArea } from "@/lib/format";

type UnitPriceFieldsProps = {
  draft: PriceDraft;
  onChange: (draft: PriceDraft) => void;
  currency: UnitsBlock["currency"];
  issue: PriceIssue | null;
  /** Квартира для примера «Кв. 41: 64,5 м² × 620 = $39 990» (цена за м²). */
  example: { number: string; area: number | null } | null;
  /** Микс с элементом блока-владельца по БЭМ: место и размер задаёт его CSS. */
  className?: string;
};

const MODES: readonly PriceMode[] = ["per_m2", "total", "none"];

/**
 * Цена (Н3): «за м² | за квартиру | без цены» и сумма целым числом с пробелами. За м² — пример
 * расчёта по площади планировки: округляет только вывод. Своё имя группы у каждого экземпляра —
 * шаг панели и правка строки могут быть открыты разом.
 */
export function UnitPriceFields({
  draft,
  onChange,
  currency,
  issue,
  example,
  className,
}: UnitPriceFieldsProps) {
  const t = useTranslations("admin.complexes.units.price");
  const id = useId();
  const label = draft.mode === "per_m2" ? "valuePerM2" : "valueTotal";
  return (
    <div className={["unit-price-fields", className].filter(Boolean).join(" ")}>
      <ChoiceField
        id={`${id}-mode`}
        name={`${id}-mode`}
        label={t("mode")}
        options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
        value={draft.mode}
        onChange={(mode) => onChange({ ...draft, mode: mode as PriceMode })}
      />
      {draft.mode === "none" ? null : (
        <Field
          id={`${id}-value`}
          label={t(label, { currency: t(`currency.${currency}`) })}
          inputMode="numeric"
          autoComplete="off"
          value={draft.raw}
          error={issueText(issue, draft.mode, t)}
          onChange={(event) => onChange({ ...draft, raw: event.target.value })}
        />
      )}
      <PriceExample draft={draft} currency={currency} example={example} />
    </div>
  );
}

type PriceT = ReturnType<typeof useTranslations<"admin.complexes.units.price">>;

function issueText(issue: PriceIssue | null, mode: PriceMode, t: PriceT) {
  if (!issue) return undefined;
  return issue === "outOfRange"
    ? t("issues.outOfRange", { max: priceMax(mode) })
    : t(`issues.${issue}`);
}

function PriceExample({
  draft,
  currency,
  example,
}: Omit<UnitPriceFieldsProps, "onChange" | "issue" | "className">) {
  const t = useTranslations("admin.complexes.units.price");
  if (draft.mode !== "per_m2" || !example) return null;
  // Тот же разбор и предел, что у «Поставить»: пример не обещает цену, которую не примут.
  const change = readPriceDraft(draft);
  const value = isPriceIssue(change) ? null : change.value;
  const shown = value === null ? null : priceExample(example.area, value, currency);
  if (!shown || example.area === null) return null;
  return (
    <p className="unit-price-fields__example">
      {t("example", { number: example.number, area: formatArea(example.area), ...shown })}
    </p>
  );
}
