"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { SelectField } from "@/components/SelectField";
import { UnitStatusPicker } from "@/components/UnitStatusPicker";
import { commonStatus } from "@/lib/admin/units/statusOutcome";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import { focusFirstInvalid } from "@/lib/ui/focusFirstInvalid";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import { BulkDeleteStep } from "./BulkDeleteStep";
import { BulkPriceStep } from "./BulkPriceStep";
import type { UnitsBulkBarProps } from "./UnitsBulkBar";

export type BulkStep = "status" | "price" | "finishing" | "remove";

export type BulkStepProps = UnitsBulkBarProps & {
  id: string;
  /** Шаг сделан или закрыт: фокус — на кнопку шага. */
  onDone: () => void;
};

/**
 * Шаг панели над строкой «Выбрано N» — растёт вверх из панели, список остаётся доступным. Фокус —
 * на первое поле шага (у «Статуса» его ставит сам выбор статуса).
 */
export function BulkSteps(props: BulkStepProps & { step: BulkStep }) {
  const { step, id } = props;
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (step !== "status") firstControl(box.current)?.focus();
  }, [step]);
  return (
    <div ref={box} id={id} className="units-bulk__step">
      {step === "status" ? <BulkStatusStep {...props} /> : null}
      {step === "price" ? <BulkPriceStep {...props} /> : null}
      {step === "finishing" ? <BulkFinishingStep {...props} /> : null}
      {step === "remove" ? <BulkDeleteStep {...props} /> : null}
    </div>
  );
}

/** Тот же выбор, что под строкой; у выбранных с одним статусом он нажат. */
function BulkStatusStep({ selection, visible, status, onDone }: BulkStepProps) {
  const t = useTranslations("admin.complexes.units.bulk");
  if (!status) return null;
  return (
    <UnitStatusPicker
      label={t("status.label")}
      status={commonStatus(selection.selected.map((unit) => unit.status))}
      onPick={(to) => {
        // На месте остаются только видимые: скрытые фильтром выделенные не всплывают в список.
        const shown = new Set(visible.map((unit) => unit.id));
        status.change(selection.selected, to, shown);
        onDone();
      }}
      onClose={onDone}
    />
  );
}

/** Сумма цены, выбранный вариант группы — и только потом первое поле: не невыбранное радио. */
function firstControl(box: HTMLElement | null) {
  return (
    box?.querySelector<HTMLElement>("input[inputmode=numeric]") ??
    box?.querySelector<HTMLElement>("input[type=radio]:checked") ??
    box?.querySelector<HTMLElement>("input, select, button") ??
    null
  );
}

const INHERIT = "inherit";

/**
 * Отделка: вариант выбирают явно — пустое значение списка значило бы «как в блоке», и «Поставить»
 * молча сбросило бы свою отделку у всех выбранных. Скрытые варианты массово не ставятся.
 */
function BulkFinishingStep({ selection, edit, block, finishings, onDone }: BulkStepProps) {
  const t = useTranslations("admin.complexes.units.bulk.finishing");
  const id = useId();
  const [value, setValue] = useState("");
  const { reply, pending, send, here } = useEditRequest();
  const submit = useRefocusAfter(pending);
  const blockName = finishings.find((item) => item.id === block.finishingId)?.name;
  const options = [
    { value: INHERIT, label: blockName ? t("inherit", { name: blockName }) : t("inheritNone") },
    ...finishings
      .filter((item) => item.isActive)
      .map((item) => ({ value: String(item.id), label: item.name })),
  ];
  const apply = async () => {
    if (!edit || !value) return;
    const finishingId = value === INHERIT ? null : Number(value);
    const result = await send((shown) => edit.setFinishing(selection.selected, finishingId, shown));
    // Шаг закрыли или сменили, пока шёл запрос, — открытое теперь не трогаем.
    if (!result && here()) onDone();
  };
  return (
    <form className="units-bulk__form" onSubmit={submitWith(apply)}>
      <SelectField
        id={id}
        label={t("label")}
        placeholder={t("choose")}
        options={options}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      {reply ? <ComplexSaveFeedback state={reply} /> : null}
      <Button ref={submit} type="submit" pending={pending} disabled={!value}>
        {t("apply")}
      </Button>
    </form>
  );
}

/** Enter в поле шага — то же, что кнопка шага; отказ по полю — фокус на него. */
export const submitWith =
  (apply: () => Promise<unknown>) => (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    void apply().then(() => focusFirstInvalid(form));
  };
