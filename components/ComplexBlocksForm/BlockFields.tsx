"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import { QuarterSelect } from "@/components/QuarterSelect";
import { SelectField, type SelectOption } from "@/components/SelectField";
import {
  BLOCK_LIMITS,
  BUILD_STATUSES,
  CADASTRE_STATUSES,
  CURRENCIES,
  type BlockDraft,
  type BlockRowErrors,
  type Currency,
} from "@/lib/admin/complexes/blocks";
import { PriceIncludes } from "./PriceIncludes";

type BlockFieldsProps = {
  block: BlockDraft;
  issues: BlockRowErrors[string] | undefined;
  finishings: readonly SelectOption[];
  onChange: (patch: Partial<BlockDraft>) => void;
};

// Срок сдачи — от недавно сданных до дальних очередей.
const DEADLINE_YEARS = { min: 2015, max: 2040 };

/** Поля открытой карточки блока (И4): стройка, сроки, отделка, кадастр, валюта, «что входит в цену». */
export function BlockFields({ block, issues, finishings, onChange }: BlockFieldsProps) {
  const t = useTranslations("admin.complexes.blocks");
  const issue = (field: string) => (issues?.[field] ? t(`issues.${issues[field]}`) : undefined);
  const id = (field: string) => `block-${block.key}-${field}`;
  const options = <T extends string>(values: readonly T[]) =>
    values.map((value) => ({ value, label: t(`values.${value}` as "values.USD") }));
  const building = block.buildStatus === "building";
  return (
    <div className="block-fields">
      <div className="block-fields__row">
        <Field
          id={id("name")}
          label={t("fields.name")}
          hint={t("fields.nameHint")}
          maxLength={BLOCK_LIMITS.nameMax}
          value={block.name}
          error={issue("name")}
          onChange={(event) => onChange({ name: event.target.value })}
        />
        <ChoiceField
          id={id("status")}
          name={id("status")}
          label={t("fields.buildStatus")}
          options={options(BUILD_STATUSES)}
          value={block.buildStatus}
          onChange={(value) => onChange({ buildStatus: value as BlockDraft["buildStatus"] })}
        />
        <CurrencyField block={block} onChange={onChange} options={options(CURRENCIES)} />
      </div>
      <div className="block-fields__row">
        <QuarterSelect
          id={id("deadline")}
          name={id("deadline")}
          label={t("fields.deadline")}
          defaultValue={block.deadline}
          minYear={DEADLINE_YEARS.min}
          maxYear={DEADLINE_YEARS.max}
          onChange={(deadline) => onChange({ deadline })}
        />
        <Field
          id={id("floors")}
          label={t("fields.floorsTotal")}
          inputMode="numeric"
          value={block.floorsTotal}
          error={issue("floorsTotal")}
          onChange={(event) => onChange({ floorsTotal: event.target.value })}
        />
        {building ? (
          <Field
            id={id("built")}
            label={t("fields.floorsBuilt")}
            inputMode="numeric"
            value={block.floorsBuilt}
            error={issue("floorsBuilt")}
            onChange={(event) => onChange({ floorsBuilt: event.target.value })}
          />
        ) : null}
        {building ? (
          <Field
            id={id("progress")}
            label={t("fields.progressPct")}
            inputMode="numeric"
            value={block.progressPct}
            error={issue("progressPct")}
            onChange={(event) => onChange({ progressPct: event.target.value })}
          />
        ) : null}
      </div>
      <div className="block-fields__row">
        <SelectField
          id={id("finishing")}
          label={t("fields.finishing")}
          placeholder={t("fields.finishingNone")}
          options={finishings}
          value={block.finishingId}
          onChange={(event) => onChange({ finishingId: event.target.value })}
        />
        <ChoiceField
          id={id("cadastre")}
          name={id("cadastre")}
          label={t("fields.cadastre")}
          options={options(CADASTRE_STATUSES)}
          value={block.cadastre}
          clearLabel={t("clear")}
          onChange={(value) => onChange({ cadastre: value as BlockDraft["cadastre"] })}
        />
        {block.cadastre === "in_progress" ? (
          <QuarterSelect
            id={id("cadastre-expected")}
            name={id("cadastre-expected")}
            label={t("fields.cadastreExpected")}
            defaultValue={block.cadastreExpectedOn}
            minYear={DEADLINE_YEARS.min}
            maxYear={DEADLINE_YEARS.max}
            onChange={(cadastreExpectedOn) => onChange({ cadastreExpectedOn })}
          />
        ) : null}
      </div>
      <PriceIncludes block={block} error={issue("priceIncludes")} onChange={onChange} />
    </div>
  );
}

type CurrencyFieldProps = {
  block: BlockDraft;
  options: { value: string; label: string }[];
  onChange: (patch: Partial<BlockDraft>) => void;
};

/**
 * Цены в валюте блока: «цена от» планировок, квартиры (у квартиры своей валюты нет) и пункты
 * «отдельно». Есть хоть одна — смена валюты спрашивает: числа не пересчитываются (курс — фаза 2).
 */
const hasPrices = (block: BlockDraft) =>
  block.pricedLayouts > 0 ||
  block.units > 0 ||
  block.priceIncludes.some((row) => !row.included && row.price.trim() !== "");

function CurrencyField({ block, options, onChange }: CurrencyFieldProps) {
  const t = useTranslations("admin.complexes.blocks");
  const [pending, setPending] = useState<Currency | null>(null);
  const pick = (value: string) => {
    const next = value as Currency;
    if (next === block.currency) return;
    if (hasPrices(block)) setPending(next);
    else onChange({ currency: next });
  };
  return (
    <div className="block-fields__currency">
      <ChoiceField
        id={`block-${block.key}-currency`}
        name={`block-${block.key}-currency`}
        label={t("fields.currency")}
        options={options}
        value={block.currency}
        onChange={pick}
      />
      {pending ? (
        <p className="block-fields__confirm">
          {t("currencyConfirm", { currency: t(`values.${pending}`) })}{" "}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onChange({ currency: pending });
              setPending(null);
            }}
          >
            {t("currencyYes")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            {t("removeCancel")}
          </Button>
        </p>
      ) : null}
    </div>
  );
}
