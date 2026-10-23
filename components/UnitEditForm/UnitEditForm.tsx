"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { SelectField } from "@/components/SelectField";
import { UnitPriceFields } from "@/components/UnitPriceFields";
import { fieldOf } from "@/lib/admin/units/editOutcome";
import type { UnitErrorField } from "@/lib/admin/units/types";
import { withField } from "@/lib/admin/units/unitForm";
import { useLayoutLabel } from "@/lib/admin/units/useLayoutLabel";
import { useFocusFirstInvalid } from "@/lib/ui/useFocusAfterRender";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import type { UnitRecord } from "@/lib/units";
import { useUnitEditForm, type UnitEditFormState } from "./useUnitEditForm";

type UnitEditFormProps = {
  unit: UnitRecord;
  /** Сохранено или «Отмена»: раскрытие закрывается, фокус — на плашку строки. */
  onDone: () => void;
};

/** Правка квартиры (Н4) в раскрытии под строкой: номер, планировка, цена, отделка. Место не правится. */
export function UnitEditForm({ unit, onDone }: UnitEditFormProps) {
  const t = useTranslations("admin.complexes.units.edit");
  const form = useUnitEditForm(unit, onDone);
  const { initial, current, reply, pending } = form;
  const submit = useRefocusAfter(pending);
  const focusInvalid = useFocusFirstInvalid();
  const changedMeanwhile = current !== null && current.updatedAt !== initial.updatedAt;
  return (
    <form
      className="unit-edit"
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        void form.save().then(() => focusInvalid(element));
      }}
    >
      <p className="unit-edit__title">
        {t("title", {
          number: initial.number,
          entrance: initial.entrance,
          floor: initial.floor,
          position: initial.position,
        })}
      </p>
      <EditFields form={form} />
      {changedMeanwhile ? <FormStatus tone="notice">{t("changed")}</FormStatus> : null}
      {form.check.twin ? (
        <FormStatus tone="notice">{t("twin", { number: form.check.twin })}</FormStatus>
      ) : null}
      {reply && !OWN_FIELDS.has(fieldOf(reply)) ? <ComplexSaveFeedback state={reply} /> : null}
      <div className="unit-edit__actions">
        <Button variant="ghost" onClick={onDone} className="unit-edit__action">
          {t("cancel")}
        </Button>
        <Button ref={submit} type="submit" pending={pending} className="unit-edit__action">
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

// Отказ базы по этим полям форма показывает у самого поля; остальное — общей строкой.
const OWN_FIELDS: ReadonlySet<UnitErrorField | null> = new Set([
  "number",
  "layout_id",
  "finishing_id",
]);

type EditT = ReturnType<typeof useTranslations<"admin.complexes.units.edit">>;

function numberError(form: UnitEditFormState, t: EditT) {
  const issue = form.tried ? form.check.issues.number : undefined;
  if (issue === "invalid") return t("issues.numberInvalid");
  if (issue === "taken" || form.reply?.error === "unitNumberTaken") return t("issues.numberTaken");
  if (form.reply && fieldOf(form.reply) === "number") return t("issues.numberInvalid");
  return undefined;
}

function EditFields({ form }: { form: UnitEditFormState }) {
  const t = useTranslations("admin.complexes.units");
  const label = useLayoutLabel(form.context.layouts);
  const tEdit = useTranslations("admin.complexes.units.edit");
  const id = useId();
  const { draft, change, context } = form;
  const area = context.layouts.find((layout) => layout.id === draft.layoutId)?.area ?? null;
  return (
    <div className="unit-edit__fields">
      <Field
        id={`${id}-number`}
        label={t("edit.number")}
        hint={t("edit.numberHint")}
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        autoFocus
        value={draft.number}
        error={numberError(form, tEdit)}
        onChange={(event) => change(withField(draft, "number", event.target.value))}
      />
      <SelectField
        id={`${id}-layout`}
        label={t("edit.layout")}
        placeholder={t("edit.noLayout")}
        options={context.layouts.map((layout) => ({ value: layout.id, label: label(layout) }))}
        value={draft.layoutId}
        error={
          form.reply && fieldOf(form.reply) === "layout_id" ? tEdit("issues.layoutGone") : undefined
        }
        onChange={(event) => change(withField(draft, "layoutId", event.target.value))}
      />
      <UnitPriceFields
        className="unit-edit__price"
        draft={draft.price}
        onChange={(price) => change(withField(draft, "price", price))}
        currency={context.block.currency}
        issue={form.tried ? (form.check.issues.price ?? null) : null}
        example={{ number: form.initial.number, area }}
      />
      <FinishingSelect form={form} id={`${id}-finishing`} />
    </div>
  );
}

/** Отделка: пусто — «как в блоке»; скрытая отделка, что уже стоит, видна, но новой её не выбрать. */
function FinishingSelect({ form, id }: { form: UnitEditFormState; id: string }) {
  const t = useTranslations("admin.complexes.units.edit");
  const { draft, change, context, initial } = form;
  const blockFinishing = context.finishings.find((item) => item.id === context.block.finishingId);
  const options = context.finishings
    .filter((item) => item.isActive || item.id === initial.finishingId)
    .map((item) => ({
      value: String(item.id),
      label: item.isActive ? item.name : t("inactive", { name: item.name }),
    }));
  return (
    <SelectField
      id={id}
      label={t("finishing")}
      placeholder={blockFinishing ? t("inherit", { name: blockFinishing.name }) : t("inheritNone")}
      options={options}
      value={draft.finishingId}
      error={
        form.reply && fieldOf(form.reply) === "finishing_id" ? t("issues.finishingGone") : undefined
      }
      onChange={(event) => change(withField(draft, "finishingId", event.target.value))}
    />
  );
}
