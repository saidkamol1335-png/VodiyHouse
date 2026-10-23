"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ComplexSaveFeedback } from "@/components/ComplexSaveFeedback";
import { FormStatus } from "@/components/FormStatus";
import { UnitPriceFields } from "@/components/UnitPriceFields";
import {
  defaultPriceMode,
  isPriceIssue,
  readPriceDraft,
  withoutLayoutCount,
  type PriceDraft,
  type PriceIssue,
} from "@/lib/admin/units/priceForm";
import type { UnitsLayout } from "@/lib/admin/units/types";
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
import type { UnitRecord } from "@/lib/units";
import { useFocusFirstInvalid } from "@/lib/ui/useFocusAfterRender";
import { useRefocusAfter } from "@/lib/ui/useRefocus";
import { submitWith, type BulkStepProps } from "./BulkSteps";

/**
 * Цена выбранных (Н3): «за м² | за квартиру | без цены». Заранее — пример расчёта по первой
 * выбранной с планировкой, сколько без планировки и — если они выбраны — что брони и проданным
 * цена тоже ставится.
 * Ошибка суммы — у поля, без запроса.
 */
export function BulkPriceStep({ selection, edit, block, layouts, onDone }: BulkStepProps) {
  const t = useTranslations("admin.complexes.units.bulk.price");
  const units = selection.selected;
  const { draft, issue, setIssue, change } = usePriceDraft(units);
  const { reply, pending, send, here } = useEditRequest();
  const submit = useRefocusAfter(pending);
  const focusInvalid = useFocusFirstInvalid();
  const apply = async () => {
    const change = readPriceDraft(draft);
    if (isPriceIssue(change)) return setIssue(change.issue);
    if (!edit) return;
    const result = await send((shown) => edit.setPrice(units, change, shown));
    // Шаг закрыли или сменили, пока шёл запрос, — открытое теперь не трогаем.
    if (!result && here()) onDone();
  };
  return (
    <form className="units-bulk__form" onSubmit={submitWith(apply, focusInvalid)}>
      <UnitPriceFields
        className="units-bulk__field"
        draft={draft}
        onChange={change}
        currency={block.currency}
        issue={issue}
        example={priceExample(units, layouts)}
      />
      <PriceNotes units={units} mode={draft.mode} />
      {reply ? <ComplexSaveFeedback state={reply} /> : null}
      <Button ref={submit} type="submit" pending={pending} className="units-bulk__button">
        {draft.mode === "none" ? t("applyNone") : t("apply")}
      </Button>
    </form>
  );
}

/** Режим цены по выбранным (за м² у квартир с планировкой); правка суммы гасит её ошибку. */
function usePriceDraft(units: readonly UnitRecord[]) {
  const [draft, setDraft] = useState<PriceDraft>(() => ({
    mode: defaultPriceMode(units),
    raw: "",
  }));
  const [issue, setIssue] = useState<PriceIssue | null>(null);
  const change = (next: PriceDraft) => {
    setDraft(next);
    setIssue(null);
  };
  return { draft, issue, setIssue, change };
}

/** Пример расчёта — по первой выбранной квартире с планировкой. */
function priceExample(units: readonly UnitRecord[], layouts: readonly UnitsLayout[]) {
  const sample = units.find((unit) => unit.layoutId !== null) ?? null;
  if (!sample) return null;
  const area = layouts.find((layout) => layout.id === sample.layoutId)?.area ?? null;
  return { number: sample.number, area };
}

/** Заранее: сколько без планировки (за м² им цену не посчитать) и что брони и проданным цена тоже ставится. */
function PriceNotes({ units, mode }: { units: readonly UnitRecord[]; mode: PriceDraft["mode"] }) {
  const t = useTranslations("admin.complexes.units.bulk.price");
  const withoutLayout = mode === "per_m2" ? withoutLayoutCount(units) : 0;
  const notFree = units.filter((unit) => unit.status !== "free").length;
  return (
    <>
      {withoutLayout > 0 ? (
        <FormStatus tone="notice">{t("withoutLayout", { count: withoutLayout })}</FormStatus>
      ) : null}
      {mode === "none" || notFree === 0 ? null : (
        <p className="units-bulk__note">{t("allStatuses", { count: notFree })}</p>
      )}
    </>
  );
}
