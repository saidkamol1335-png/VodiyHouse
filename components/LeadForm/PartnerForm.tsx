"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { maskPhone } from "@/lib/leads/phoneMask";
import { PARTNER_ANCHOR, PARTNER_FORMATS, type PartnerFormat } from "@/lib/leads/partner";
import type { LeadFieldErrors, SiteLang } from "@/lib/leads/types";
import { LeadChoices } from "./LeadChoices";
import { LeadDone } from "./LeadDone";
import { LeadConsent, TrapField } from "./LeadForm";
import { useLeadSubmit } from "./useLeadSubmit";

const FORM_ID = "partner-form";
const INTENT = { type: "partner" as const };
const id = (name: string) => `${FORM_ID}-${name}`;

type PartnerFields = {
  company: string;
  name: string;
  phone: string;
  city: string;
  format: PartnerFormat | null;
  projects: string;
  comment: string;
  trap: string;
};

type TextKey = Exclude<keyof PartnerFields, "format">;
type FieldsProps = { fields: PartnerFields; onChange: (patch: Partial<PartnerFields>) => void };

const formatOf = (hash: string) => PARTNER_FORMATS.find((value) => hash === `#${PARTNER_ANCHOR}-${value}`);

/**
 * «Выбрать» у формата — ссылка #zayavka-<формат>: форма берёт формат, прокручивается и ставит фокус.
 * По каждому нажатию (повторное «Выбрать» адрес не меняет) и при заходе по такой ссылке.
 */
function useFormatFromHash(onFormat: (format: PartnerFormat) => void) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const apply = (format: PartnerFormat | undefined) => {
      if (!format) return false;
      onFormat(format);
      form.current?.scrollIntoView({ block: "center" });
      document.getElementById(id("company"))?.focus({ preventScroll: true });
      return true;
    };
    const onClick = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>(`a[href^="#${PARTNER_ANCHOR}-"]`) : null;
      if (link && apply(formatOf(link.hash))) {
        event.preventDefault();
        window.history.replaceState(null, "", link.hash);
      }
    };
    apply(formatOf(window.location.hash));
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [onFormat]);
  return form;
}

/** Поля, «Выбрать» у формата и отправка: формат уходит подписью на языке сайта. */
function usePartnerForm(defaultCity: string) {
  const t = useTranslations("lead.partner");
  const locale = useLocale() as SiteLang;
  const empty = { company: "", name: "", phone: "", format: null, projects: "", comment: "", trap: "" };
  const [fields, setFields] = useState<PartnerFields>({ ...empty, city: defaultCity });
  const { submit, fields: errors, edited, error, sent, pending, reset } = useLeadSubmit(FORM_ID, INTENT);
  const onChange = useCallback(
    (patch: Partial<PartnerFields>) => {
      setFields((current) => ({ ...current, ...patch }));
      // Правка поля снимает его ошибку — до следующей отправки.
      for (const key of ["company", "name", "phone"] as const) if (key in patch) edited(key);
    },
    [edited],
  );
  const pickFormat = useCallback((format: PartnerFormat) => onChange({ format }), [onChange]);
  const form = useFormatFromHash(pickFormat);
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const { company, city, projects, comment, name, phone, trap } = fields;
    const format = fields.format ? t(`formats.${fields.format}`) : "";
    submit({ name, phone, lang: locale, trap }, null, { company, city, format, projects, comment });
  };
  const again = () => {
    reset();
    setFields((current) => ({ ...empty, city: current.city }));
  };
  return { fields, onChange, form, onSubmit, errors, error, sent, pending, again };
}

/**
 * «Заявка на сотрудничество» (мокап SitePartners, шаг 3.11): компания, контактное лицо, телефон,
 * город, что интересует, сколько ЖК и квартир, комментарий; заявка «Застройщик · сотрудничество».
 */
export function PartnerForm({ defaultCity }: { defaultCity: string }) {
  const t = useTranslations("lead");
  const { fields, onChange, form, onSubmit, errors, error, sent, pending, again } = usePartnerForm(defaultCity);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) done.current?.focus();
  }, [sent]);
  if (sent) {
    return (
      <div className="lead-form">
        <LeadDone ref={done} type="partner" number={sent.number} repeat={sent.repeat} />
        <Button variant="outline" onClick={again}>
          {t("partner.again")}
        </Button>
      </div>
    );
  }
  return (
    <form ref={form} className="lead-form" noValidate onSubmit={onSubmit} aria-busy={pending}>
      <PartnerContacts fields={fields} onChange={onChange} errors={errors} />
      <PartnerDetails fields={fields} onChange={onChange} />
      {error ? <FormStatus tone="error">{t(`errors.${error}`)}</FormStatus> : null}
      <Button type="submit" block pending={pending} className="lead-form__submit">
        <Send size={16} aria-hidden="true" />
        {pending ? t("sending") : t("partner.send")}
      </Button>
      <LeadConsent />
    </form>
  );
}

/** Поле-строка: значение и правка одним ключом. */
const bind = ({ fields, onChange }: FieldsProps, key: TextKey) => ({
  value: fields[key],
  onChange: (event: { target: { value: string } }) => onChange({ [key]: event.target.value }),
});

/** Компания и контактное лицо, телефон и город — парами (на телефоне столбиком), ловушка. */
function PartnerContacts({ errors, ...props }: FieldsProps & { errors: LeadFieldErrors }) {
  const t = useTranslations("lead");
  const { fields, onChange } = props;
  const phoneKey = errors.phone === "required" ? "fieldErrors.phoneRequired" : "fieldErrors.phone";
  return (
    <div className="lead-form__two">
      <Field
        id={id("company")}
        label={t("partner.company")}
        autoComplete="organization"
        error={errors.company ? t("partner.companyRequired") : undefined}
        {...bind(props, "company")}
      />
      <Field
        id={id("name")}
        label={t("partner.name")}
        autoComplete="name"
        error={errors.name ? t("fieldErrors.name") : undefined}
        {...bind(props, "name")}
      />
      <Field
        id={id("phone")}
        label={t("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("phonePlaceholder")}
        value={fields.phone}
        error={errors.phone ? t(phoneKey) : undefined}
        onFocus={() => (fields.phone ? undefined : onChange({ phone: "+998 " }))}
        onChange={(event) => onChange({ phone: maskPhone(event.target.value) })}
      />
      <Field id={id("city")} label={t("partner.city")} autoComplete="address-level2" {...bind(props, "city")} />
      <TrapField value={fields.trap} onChange={(trap) => onChange({ trap })} />
    </div>
  );
}

/** Что интересует (чипы, по желанию), сколько ЖК и квартир в продаже, комментарий. */
function PartnerDetails(props: FieldsProps) {
  const t = useTranslations("lead.partner");
  const { fields, onChange } = props;
  return (
    <>
      <LeadChoices
        name={id("format")}
        legend={t("format")}
        options={PARTNER_FORMATS.map((value) => ({ value, label: t(`formats.${value}`) }))}
        value={fields.format}
        optional
        onChange={(format) => onChange({ format })}
      />
      <Field id={id("projects")} label={t("projects")} placeholder={t("projectsPlaceholder")} {...bind(props, "projects")} />
      <div className="field">
        <label className="field__label" htmlFor={id("comment")}>
          {t("comment")}
        </label>
        <textarea
          id={id("comment")}
          className="field__input lead-form__textarea"
          rows={3}
          maxLength={1000}
          placeholder={t("commentPlaceholder")}
          {...bind(props, "comment")}
        />
      </div>
    </>
  );
}
