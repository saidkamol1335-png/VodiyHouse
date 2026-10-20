"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { PRIVATE_LIMITS, type PrivateNotes } from "@/lib/admin/developers/privateNotes";
import type { FormAction, SavePrivateResult } from "@/lib/admin/developers/types";

type DeveloperPrivateFormProps = {
  developerId: string;
  notes: PrivateNotes;
  action: FormAction<SavePrivateResult>;
};

const IDLE: SavePrivateResult = { status: "idle" };

/** Вкладка «Внутреннее»: контакты застройщика и заметки — никогда не на сайте (правило ТЗ 1.2). */
export function DeveloperPrivateForm({ developerId, notes, action }: DeveloperPrivateFormProps) {
  const t = useTranslations("admin.developers");
  const [state, formAction, pending] = useActionState(
    (_previous: SavePrivateResult, formData: FormData) => action(formData),
    IDLE,
  );
  const failed = state.status === "error" ? state : null;
  const values = failed?.fields ?? notes;
  return (
    <AdminPanel title={t("private.title")} wide>
      <form className="developer-private" action={formAction} noValidate>
        <input type="hidden" name="id" value={developerId} />
        <p className="developer-private__lead">{t("private.lead")}</p>
        <NotesField
          id="developer-contacts"
          name="contacts"
          label={t("private.contacts")}
          hint={t("private.contactsHint")}
          defaultValue={values.contacts}
          max={PRIVATE_LIMITS.contactsMax}
          rows={4}
        />
        <NotesField
          id="developer-notes"
          name="notes"
          label={t("private.notes")}
          hint={t("private.notesHint")}
          defaultValue={values.notes}
          max={PRIVATE_LIMITS.notesMax}
          rows={6}
        />
        <div className="developer-private__save">
          {state.status === "saved" ? (
            <FormStatus key={state.at} tone="success">
              {t("saved")}
            </FormStatus>
          ) : null}
          {failed ? (
            <FormStatus tone="error">{t(`errors.${failed.error ?? "invalid"}`)}</FormStatus>
          ) : null}
          <Button type="submit" pending={pending}>
            {pending ? t("pending") : t("private.save")}
          </Button>
        </div>
      </form>
    </AdminPanel>
  );
}

type NotesFieldProps = {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultValue: string;
  max: number;
  rows: number;
};

/** Многострочное поле мокапа (textarea.inp): переводы строк сохраняются. */
function NotesField({ id, name, label, hint, defaultValue, max, rows }: NotesFieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        className="field__input field__input--multiline"
        rows={rows}
        maxLength={max}
        defaultValue={defaultValue}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="field__meta">
        {hint}
      </p>
    </div>
  );
}
