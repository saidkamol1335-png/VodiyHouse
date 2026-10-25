"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ComplexTabForm } from "@/components/ComplexTabForm";
import { Field } from "@/components/Field";
import { documentField, todayInTashkent, type DocumentRow } from "@/lib/admin/complexes/documents";
import type { DocumentsResult } from "@/lib/admin/complexes/types";
import type { FormAction } from "@/lib/admin/developers/types";
import { useTabSave } from "@/lib/ui/useTabSave";

type ComplexDocumentsFormProps = {
  complexId: string;
  documents: readonly DocumentRow[];
  action: FormAction<DocumentsResult>;
};

/**
 * Вкладка «Документы» (ТЗ 7.8): по строке на документ справочника — дата проверки Vodiy House.
 * С датой — документ на сайте («Проверено …»), без даты — его там нет. Сканов здесь нет: клиент
 * запрашивает их у Vodiy House (правило 1.2).
 */
export function ComplexDocumentsForm({ complexId, documents, action }: ComplexDocumentsFormProps) {
  const t = useTranslations("admin.complexes");
  const save = useTabSave(action, t("unsaved"));
  const errors = save.state.status === "error" ? save.state.errors : {};
  // Граница календаря — сегодня по Ташкенту; база ещё раз не пустит завтрашнюю дату.
  const [today] = useState(todayInTashkent);
  return (
    <ComplexTabForm title={t("documents.title")} lead={t("documents.lead")} complexId={complexId} save={save}>
      {documents.length === 0 ? <p className="complex-documents-form__empty">{t("documents.empty")}</p> : null}
      <ul className="complex-documents-form">
        {documents.map((document) => {
          const issue = errors[document.typeId];
          return (
            <li key={document.typeId} className="complex-documents-form__row">
              <input type="hidden" name="documentType" value={document.typeId} />
              <div className="complex-documents-form__text">
                <span className="complex-documents-form__name">{document.name.ru}</span>
                <span className="complex-documents-form__hint">{document.hint?.ru ?? t("documents.noHint")}</span>
              </div>
              <Field
                className="complex-documents-form__date"
                id={`complex-${documentField(document.typeId)}`}
                name={documentField(document.typeId)}
                label={t("documents.checkedOn")}
                type="date"
                max={today}
                defaultValue={document.checkedOn}
                error={issue ? t(`documents.issues.${issue}`) : undefined}
              />
            </li>
          );
        })}
      </ul>
    </ComplexTabForm>
  );
}
