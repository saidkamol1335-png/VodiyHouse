"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AdminPanel } from "@/components/AdminPanel";
import { BilingualField } from "@/components/BilingualField";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { EMPTY_BILINGUAL, type BilingualIssue } from "@/lib/admin/bilingual";
import {
  CONTACTS_LIMITS,
  FREE_SERVICE_FIELDS,
  type ContactsActionResult,
  type ContactsErrors,
  type ContactsFields,
  type ContactsIssue,
} from "@/lib/admin/contacts/contactsForm";
import type { FormAction } from "@/lib/admin/developers/types";

type ContactsFormProps = {
  fields: ContactsFields;
  action: FormAction<ContactsActionResult>;
};

const IDLE: ContactsActionResult = { status: "idle" };
const BILINGUAL_ISSUES: ReadonlySet<string> = new Set(["required", "missingRu", "missingUz", "tooLong"]);
const isBilingualIssue = (code: ContactsIssue): code is BilingualIssue => BILINGUAL_ISSUES.has(code);

/** «Настройки → Контакты» (Ф9): единственные контакты сайта; пустое поле — кнопки на сайте нет. */
export function ContactsForm({ fields, action }: ContactsFormProps) {
  const t = useTranslations("admin.contacts");
  const [state, formAction, pending] = useActionState(
    (_previous: ContactsActionResult, formData: FormData) => action(formData),
    IDLE,
  );
  const failed = state.status === "error" ? state : null;
  const values = failed?.fields ?? fields;
  const issue = useIssue(failed?.fieldErrors ?? {});
  return (
    <AdminPanel title={t("title")} wide>
      {/* key: после сохранения поля берут значения, приведённые сервером («90…» → «+998…»). */}
      <form key={state.status === "saved" ? state.at : "form"} className="contacts-form" action={formAction} noValidate>
        <p className="contacts-form__lead">{t("lead")}</p>
        <div className="contacts-form__grid">
          <Field id="contacts-phone" name="phone" label={t("fields.phone")} hint={t("hints.phone")} defaultValue={values.phone} inputMode="tel" autoComplete="off" error={issue("phone")} />
          <Field id="contacts-telegram" name="telegram" label={t("fields.telegram")} hint={t("hints.telegram")} defaultValue={values.telegram} autoComplete="off" error={issue("telegram")} />
          <Field id="contacts-bot" name="bot" label={t("fields.bot")} hint={t("hints.bot")} defaultValue={values.bot} autoComplete="off" error={issue("bot")} />
          <Field id="contacts-instagram" name="instagram" label={t("fields.instagram")} hint={t("hints.instagram")} defaultValue={values.instagram} autoComplete="off" error={issue("instagram")} />
          <Field id="contacts-minutes" name="callbackMinutes" label={t("fields.callbackMinutes")} hint={t("hints.callbackMinutes")} defaultValue={values.callbackMinutes} inputMode="numeric" error={issue("callbackMinutes")} />
        </div>
        <BilingualField id="contacts-hours" name="hours" label={t("fields.hours")} uzLabel={t("fields.hoursUz")} maxLength={CONTACTS_LIMITS.hoursMax} defaultValue={values.hours} error={issue("hours")} />
        <BilingualField id="contacts-free" name="freeBadge" label={t("fields.freeBadge")} uzLabel={t("fields.freeBadgeUz")} maxLength={CONTACTS_LIMITS.freeBadgeMax} defaultValue={values.freeBadge} error={issue("freeBadge")} />
        <FreeServices values={values.freeServices} issue={issue} />
        <ContactsSave state={state} pending={pending} />
      </form>
    </AdminPanel>
  );
}

type FreeServicesProps = {
  values: ContactsFields["freeServices"];
  issue: (field: keyof ContactsErrors) => string | undefined;
};

/** Пункты плашки «Для вас бесплатно» на странице ЖК (ТЗ 7.1): до четырёх, RU | UZ. */
function FreeServices({ values, issue }: FreeServicesProps) {
  const t = useTranslations("admin.contacts");
  return (
    <fieldset className="contacts-form__services">
      <legend className="contacts-form__legend">{t("fields.freeServices")}</legend>
      <p className="contacts-form__lead">{t("hints.freeServices")}</p>
      {FREE_SERVICE_FIELDS.map((name, index) => (
        <BilingualField key={name} id={`contacts-${name}`} name={name} label={t("fields.freeService", { n: index + 1 })} uzLabel={t("fields.freeServiceUz", { n: index + 1 })} maxLength={CONTACTS_LIMITS.freeServiceMax} defaultValue={values[index] ?? EMPTY_BILINGUAL} error={issue(name)} />
      ))}
    </fieldset>
  );
}

/** Текст ошибки поля: свои — admin.contacts.issues, двуязычные — общие admin.developers.issues. */
function useIssue(errors: ContactsErrors) {
  const t = useTranslations("admin");
  return (field: keyof ContactsErrors) => {
    const code = errors[field];
    if (!code) return undefined;
    return isBilingualIssue(code) ? t(`developers.issues.${code}`, { min: 0 }) : t(`contacts.issues.${code}`);
  };
}

function ContactsSave({ state, pending }: { state: ContactsActionResult; pending: boolean }) {
  const t = useTranslations("admin");
  return (
    <div className="contacts-form__save">
      {state.status === "saved" ? (
        <FormStatus key={state.at} tone="success">
          {t("contacts.saved")}
        </FormStatus>
      ) : null}
      {state.status === "error" && state.error ? (
        <FormStatus tone="error">{t(`developers.errors.${state.error}`)}</FormStatus>
      ) : null}
      <Button type="submit" pending={pending} className="contacts-form__submit">
        {pending ? t("developers.pending") : t("contacts.save")}
      </Button>
    </div>
  );
}
