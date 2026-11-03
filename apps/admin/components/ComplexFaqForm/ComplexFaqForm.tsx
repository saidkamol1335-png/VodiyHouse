"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { FAQ_LIMITS, faqField, newFaqDraft, type FaqDraft, type FaqErrors, type FaqIssue } from "@/lib/admin/complexes/faq";
import type { FaqResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useTabSave } from "@/lib/ui/useTabSave";

type ComplexFaqFormProps = {
  complexId: string;
  faq: readonly FaqDraft[];
  action: FormAction<FaqResult>;
};

/** «Частые вопросы» на «О ЖК» (PLAN §10, п. 21): до 8 пар, порядок — как на сайте. */
export function ComplexFaqForm({ complexId, faq, action }: ComplexFaqFormProps) {
  const t = useTranslations("admin.complexes");
  const save = useTabSave(action, t("unsaved"));
  const draft = useDraftRows(faq, { dirty: save.dirty, savedAt: save.savedAt, markDirty: save.onInput });
  const errors: FaqErrors = save.state.status === "error" ? save.state.errors : {};
  const move = (index: number, by: -1 | 1) =>
    draft.change((rows) => {
      const next = [...rows];
      [next[index], next[index + by]] = [next[index + by]!, next[index]!];
      return next;
    });
  const add = (
    <Button
      variant="ghost"
      size="sm"
      disabled={draft.rows.length >= FAQ_LIMITS.maxRows}
      onClick={() => draft.change((rows) => [...rows, newFaqDraft()])}
    >
      + {t("faq.add")}
    </Button>
  );
  return (
    <ComplexTabForm title={t("faq.title")} lead={t("faq.lead")} complexId={complexId} save={save} extra={add}>
      {draft.rows.length === 0 ? <p className="complex-faq-form__empty">{t("faq.empty")}</p> : null}
      <ol className="complex-faq-form">
        {draft.rows.map((row, index) => (
          <FaqRow
            key={row.key}
            row={row}
            index={index}
            last={index === draft.rows.length - 1}
            errors={errors[row.key]}
            onMove={(by) => move(index, by)}
            onRemove={() => draft.remove(row.key)}
          />
        ))}
      </ol>
    </ComplexTabForm>
  );
}

type FaqRowProps = {
  row: FaqDraft;
  index: number;
  last: boolean;
  errors: FaqErrors[string] | undefined;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

/** Пара: вопрос и ответ RU | UZ, порядок и корзина. */
function FaqRow({ row, index, last, errors, onMove, onRemove }: FaqRowProps) {
  const t = useTranslations("admin.complexes.faq");
  const issue = (code: FaqIssue | undefined) => (code ? t(`issues.${code}`) : undefined);
  return (
    <li className="complex-faq-form__row" role="group" aria-label={t("row", { n: index + 1 })}>
      <input type="hidden" name="faqKey" value={row.key} />
      <span className="complex-faq-form__number">{index + 1}</span>
      <div className="complex-faq-form__fields">
        <BilingualField
          id={`complex-${faqField(row.key, "q")}`}
          name={faqField(row.key, "q")}
          label={t("question")}
          uzLabel={t("questionUz")}
          maxLength={FAQ_LIMITS.questionMax}
          defaultValue={row.q}
          error={issue(errors?.q)}
        />
        <BilingualField
          id={`complex-${faqField(row.key, "a")}`}
          name={faqField(row.key, "a")}
          label={t("answer")}
          uzLabel={t("answerUz")}
          maxLength={FAQ_LIMITS.answerMax}
          multiline
          defaultValue={row.a}
          error={issue(errors?.a)}
        />
      </div>
      <div className="complex-faq-form__tools">
        <button type="button" className="complex-faq-form__tool" aria-label={t("up")} aria-disabled={index === 0} onClick={() => index > 0 && onMove(-1)}>
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("down")} aria-disabled={last} onClick={() => !last && onMove(1)}>
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button type="button" className="complex-faq-form__tool" aria-label={t("remove")} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
