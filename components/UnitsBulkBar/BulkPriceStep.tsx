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
import { useEditRequest } from "@/lib/admin/units/useEditRequest";
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
  const [draft, setDraft] = useState<PriceDraft>(() => ({
    mode: defaultPriceMode(units),
    raw: "",
  }));
  const [issue, setIssue] = useState<PriceIssue | null>(null);
  const { reply, pending, send, here } = useEditRequest();
  const submit = useRefocusAfter(pending);
  const focusInvalid = useFocusFirstInvalid();
  const sample = units.find((unit) => unit.layoutId !== null) ?? null;
  const area = layouts.find((layout) => layout.id === sample?.layoutId)?.area ?? null;
  const withoutLayout = draft.mode === "per_m2" ? withoutLayoutCount(units) : 0;
  const notFree = units.filter((unit) => unit.status !== "free").length;
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
        onChange={(next) => {
          setDraft(next);
          setIssue(null);
        }}
        currency={block.currency}
        issue={issue}
        example={sample ? { number: sample.number, area } : null}
      />
      {withoutLayout > 0 ? (
        <FormStatus tone="notice">{t("withoutLayout", { count: withoutLayout })}</FormStatus>
      ) : null}
      {draft.mode === "none" || notFree === 0 ? null : (
        <p className="units-bulk__note">{t("allStatuses", { count: notFree })}</p>
      )}
      {reply ? <ComplexSaveFeedback state={reply} /> : null}
      <Button ref={submit} type="submit" pending={pending} className="units-bulk__button">
        {draft.mode === "none" ? t("applyNone") : t("apply")}
      </Button>
    </form>
  );
}
