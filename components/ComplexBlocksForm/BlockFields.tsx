"use client";

import { useTranslations } from "next-intl";
import { ChoiceField } from "@/components/ChoiceField";
import { Field } from "@/components/Field";
import { QuarterSelect } from "@/components/QuarterSelect";
import { SelectField, type SelectOption } from "@/components/SelectField";
import { BLOCK_LIMITS, BUILD_STATUSES, CADASTRE_STATUSES, CURRENCIES, type BlockDraft, type BlockRowErrors } from "@/lib/admin/complexes/blocks";
import { CurrencyField } from "./CurrencyField";
import { PriceIncludes } from "./PriceIncludes";

type BlockFieldsProps = {
  block: BlockDraft;
  issues: BlockRowErrors[string] | undefined;
  finishings: readonly SelectOption[];
  onChange: (patch: Partial<BlockDraft>) => void;
};

type RowProps = Omit<BlockFieldsProps, "finishings">;

// Срок сдачи — от недавно сданных до дальних очередей.
const DEADLINE_YEARS = { min: 2015, max: 2040 };

/** Поля открытой карточки блока (И4): стройка, сроки, отделка, кадастр, валюта, «что входит в цену». */
export function BlockFields(props: BlockFieldsProps) {
  const { issue } = useBlockFieldKit(props.block, props.issues);
  return (
    <div className="block-fields">
      <BlockBasicsRow {...props} />
      <BlockProgressRow {...props} />
      <BlockCadastreRow {...props} />
      <PriceIncludes block={props.block} error={issue("priceIncludes")} onChange={props.onChange} />
    </div>
  );
}

/** Общее у рядов: тексты, ошибка поля, id по ключу блока, варианты сегмента. */
function useBlockFieldKit(block: BlockDraft, issues: RowProps["issues"]) {
  const t = useTranslations("admin.complexes.blocks");
  const issue = (field: string) => (issues?.[field] ? t(`issues.${issues[field]}`) : undefined);
  const id = (field: string) => `block-${block.key}-${field}`;
  const options = <T extends string>(values: readonly T[]) => values.map((value) => ({ value, label: t(`values.${value}` as "values.USD") }));
  return { t, issue, id, options };
}

function BlockBasicsRow({ block, issues, onChange }: RowProps) {
  const { t, issue, id, options } = useBlockFieldKit(block, issues);
  return (
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
  );
}

function BlockProgressRow(props: RowProps) {
  const { block, issues, onChange } = props;
  const { t, issue, id } = useBlockFieldKit(block, issues);
  return (
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
      {block.buildStatus === "building" ? <BuildingFloors {...props} /> : null}
    </div>
  );
}

/** Только у строящегося блока: сколько этажей готово и процент готовности. */
function BuildingFloors({ block, issues, onChange }: RowProps) {
  const { t, issue, id } = useBlockFieldKit(block, issues);
  return (
    <>
      <Field
        id={id("built")}
        label={t("fields.floorsBuilt")}
        inputMode="numeric"
        value={block.floorsBuilt}
        error={issue("floorsBuilt")}
        onChange={(event) => onChange({ floorsBuilt: event.target.value })}
      />
      <Field
        id={id("progress")}
        label={t("fields.progressPct")}
        inputMode="numeric"
        value={block.progressPct}
        error={issue("progressPct")}
        onChange={(event) => onChange({ progressPct: event.target.value })}
      />
    </>
  );
}

function BlockCadastreRow({ block, issues, finishings, onChange }: BlockFieldsProps) {
  const { t, id, options } = useBlockFieldKit(block, issues);
  return (
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
  );
}
