"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { Field } from "@/components/Field";
import { aboutField, HISTORY_LIMITS, newHistoryDraft, type AboutErrors, type AboutIssue, type AboutResult, type HistoryDraft } from "@/lib/admin/about/forms";
import type { FormAction } from "@/lib/admin/developers/types";
import { useDraftRows } from "@/lib/ui/useDraftRows";
import { useTabSave } from "@/lib/ui/useTabSave";

type AboutHistoryFormProps = { events: readonly HistoryDraft[]; action: FormAction<AboutResult> };

/**
 * «История» на /o-nas (правки 15.11, п. 25): события — год, заголовок и короткий текст на двух языках;
 * на сайте — по году. Без событий раздела нет.
 */
export function AboutHistoryForm({ events, action }: AboutHistoryFormProps) {
  const t = useTranslations("admin.about");
  const tc = useTranslations("admin.complexes");
  const save = useTabSave(action, tc("unsaved"));
  const draft = useDraftRows(events, { dirty: save.dirty, savedAt: save.savedAt, markDirty: save.onInput });
  const errors: AboutErrors = save.state.status === "error" ? save.state.errors : {};
  const add = (
    <Button variant="ghost" size="sm" disabled={draft.rows.length >= HISTORY_LIMITS.maxRows} onClick={() => draft.change((rows) => [...rows, newHistoryDraft()])}>
      + {t("history.add")}
    </Button>
  );
  return (
    <ComplexTabForm title={t("history.title")} lead={t("history.lead")} save={save} extra={add}>
      {draft.rows.length === 0 ? <p className="complex-faq-form__empty">{t("history.empty")}</p> : null}
      <ol className="complex-faq-form">
        {draft.rows.map((row, index) => (
          <HistoryRow key={row.key} row={row} index={index} errors={errors[row.key]} onRemove={() => draft.remove(row.key)} />
        ))}
      </ol>
    </ComplexTabForm>
  );
}

type HistoryRowProps = { row: HistoryDraft; index: number; errors: AboutErrors[string] | undefined; onRemove: () => void };

function HistoryRow({ row, index, errors, onRemove }: HistoryRowProps) {
  const t = useTranslations("admin.about");
  const issue = (code: AboutIssue | undefined) => (code ? t(`issues.${code}`) : undefined);
  return (
    <li className="complex-faq-form__row" role="group" aria-label={t("history.row", { n: index + 1 })}>
      <input type="hidden" name="historyKey" value={row.key} />
      <Field
        id={`about-${aboutField(row.key, "year")}`}
        name={aboutField(row.key, "year")}
        label={t("history.year")}
        inputMode="numeric"
        maxLength={4}
        className="about-history-form__year"
        defaultValue={row.year}
        error={issue(errors?.year)}
      />
      <div className="complex-faq-form__fields">
        <BilingualField id={`about-${aboutField(row.key, "title")}`} name={aboutField(row.key, "title")} label={t("history.eventTitle")} uzLabel={t("history.eventTitleUz")} maxLength={HISTORY_LIMITS.titleMax} defaultValue={row.title} error={issue(errors?.title)} />
        <BilingualField id={`about-${aboutField(row.key, "text")}`} name={aboutField(row.key, "text")} label={t("history.text")} uzLabel={t("history.textUz")} maxLength={HISTORY_LIMITS.textMax} multiline defaultValue={row.text} error={issue(errors?.text)} />
      </div>
      <div className="complex-faq-form__tools">
        <button type="button" className="complex-faq-form__tool" aria-label={t("history.remove")} onClick={onRemove}>
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
