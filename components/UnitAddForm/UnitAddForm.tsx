"use client";

import { useTranslations } from "next-intl";
import { useId } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { SelectField } from "@/components/SelectField";
import { fieldOf } from "@/lib/admin/units/editOutcome";
import type { UnitErrorField, UnitsLayout } from "@/lib/admin/units/types";
import { useLayoutLabel } from "@/lib/admin/units/useLayoutLabel";
import type { UnitsEditControl } from "@/lib/admin/units/useUnitsEdit";
import { useFocusFirstInvalid } from "@/lib/ui/useFocusAfterRender";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import type { Riser, UnitRecord } from "@/lib/units";
import { useUnitAddForm, type UnitAddFormState } from "./useUnitAddForm";

type UnitAddFormProps = {
  units: readonly UnitRecord[];
  layouts: readonly UnitsLayout[];
  floorsTotal: number;
  risers: readonly Riser[];
  edit: UnitsEditControl;
  onClose: () => void;
};

/** «+ Квартира» (Н4): над стояками, место и номер, планировка по стояку. Создаётся свободной. */
export function UnitAddForm({ onClose, ...params }: UnitAddFormProps) {
  const t = useTranslations("admin.complexes.units.add");
  const form = useUnitAddForm(params);
  const { reply, added, pending } = form;
  // «Добавить» недоступна, пока идёт запрос: фокус вернётся на неё — форма ждёт следующую.
  const submit = useRefocusAfter(pending);
  const focusInvalid = useFocusFirstInvalid();
  return (
    <form
      className="unit-add"
      aria-label={t("title")}
      onSubmit={(event) => {
        event.preventDefault();
        const element = event.currentTarget;
        void form.submit().then(() => focusInvalid(element));
      }}
    >
      <p className="unit-add__title">{t("title")}</p>
      <p className="unit-add__lead">{t("lead")}</p>
      <SlotFields form={form} />
      <NumberAndLayout form={form} layouts={params.layouts} />
      {added ? <FormStatus tone="success">{t("added", { number: added })}</FormStatus> : null}
      {reply && !OWN_FIELDS.has(fieldOf(reply)) ? <ComplexSaveFeedback state={reply} /> : null}
      <div className="unit-add__actions">
        <Button variant="ghost" onClick={onClose} className="unit-add__action">
          {t("close")}
        </Button>
        <Button ref={submit} type="submit" pending={pending} className="unit-add__action">
          {pending ? t("adding") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

// Отказ базы по этим полям форма показывает у самого поля; остальное — общей строкой.
const OWN_FIELDS: ReadonlySet<UnitErrorField | null> = new Set(["slot", "number", "layout_id"]);

type AddT = ReturnType<typeof useTranslations<"admin.complexes.units.add">>;
type ErrorsT = ReturnType<typeof useTranslations<"admin.developers.errors">>;

function slotError({ issues, reply }: UnitAddFormState, t: AddT, tErrors: ErrorsT) {
  if (issues.slotTaken) return t("taken", { number: issues.slotTaken });
  if (reply?.error === "unitSlotTaken") return tErrors("unitSlotTaken");
  // Этажность блока уменьшили, пока форма открыта: базе такого места уже нет.
  if (reply && fieldOf(reply) === "slot") return t("slotInvalid");
  return null;
}

/** Подъезд · этаж · позиция: пределы — в подсказке, занятое место — ошибкой с номером квартиры. */
function SlotFields({ form }: { form: UnitAddFormState }) {
  const t = useTranslations("admin.complexes.units.add");
  const tErrors = useTranslations("admin.developers.errors");
  const id = useId();
  const { draft, change, limits, issues } = form;
  const error = slotError(form, t, tErrors);
  const errorId = `${id}-slot-error`;
  // «Место занято» — про все три поля: они неверны вместе и связаны с этим текстом.
  const slotTaken = (key: string) =>
    error ? { "aria-invalid": true, "aria-describedby": `${id}-${key}-hint ${errorId}` } : {};
  const field = (key: "entrance" | "floor" | "position", max: number) => (
    <Field
      id={`${id}-${key}`}
      label={t(key)}
      inputMode="numeric"
      autoComplete="off"
      value={draft[key]}
      hint={t(`${key}Range`, { max })}
      error={issues[key] ? t(`${key}Range`, { max }) : undefined}
      onChange={(event) => change({ ...draft, [key]: event.target.value })}
      {...(issues[key] ? {} : slotTaken(key))}
    />
  );
  return (
    <div className="unit-add__slot">
      {field("entrance", limits.maxEntrance)}
      {field("floor", limits.floors)}
      {field("position", limits.maxPosition(Number(draft.entrance) || 1))}
      {error ? (
        <p id={errorId} className="unit-add__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type UnitsT = ReturnType<typeof useTranslations<"admin.complexes.units">>;

/** Номер занят или не подходит — до запроса (issues) или по отказу базы (reply). */
function numberError({ issues, reply }: UnitAddFormState, t: UnitsT) {
  if (issues.number === "taken" || reply?.error === "unitNumberTaken")
    return t("edit.issues.numberTaken");
  if (issues.number === "invalid" || (reply !== null && fieldOf(reply) === "number"))
    return t("edit.issues.numberInvalid");
  return undefined;
}

function NumberAndLayout({
  form,
  layouts,
}: {
  form: UnitAddFormState;
  layouts: readonly UnitsLayout[];
}) {
  const t = useTranslations("admin.complexes.units");
  const label = useLayoutLabel(layouts);
  const id = useId();
  const { draft, change, reply } = form;
  return (
    <div className="unit-add__row">
      <Field
        id={`${id}-number`}
        label={t("add.number")}
        hint={t("edit.numberHint")}
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        value={draft.number}
        error={numberError(form, t)}
        onChange={(event) => change({ ...draft, number: event.target.value })}
      />
      <SelectField
        id={`${id}-layout`}
        label={t("add.layout")}
        placeholder={t("edit.noLayout")}
        options={layouts.map((layout) => ({ value: layout.id, label: label(layout) }))}
        value={form.layoutId}
        hint={form.layoutByRiser ? t("add.byRiser") : undefined}
        error={reply && fieldOf(reply) === "layout_id" ? t("edit.issues.layoutGone") : undefined}
        onChange={(event) => form.setLayout(event.target.value)}
      />
    </div>
  );
}
