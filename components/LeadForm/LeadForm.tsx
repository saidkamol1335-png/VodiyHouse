"use client";

import { Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { FormStatus } from "@/components/FormStatus";
import { Link } from "@/lib/i18n/navigation";
import { maskPhone } from "@/lib/leads/phoneMask";
import {
  VIEW_DAYS,
  VIEW_TARGETS,
  VIEW_TIMES,
  type LeadField,
  type LeadFieldErrors,
  type SiteLang,
  type ViewChoice,
  type ViewTarget,
} from "@/lib/leads/types";
import { ROUTES } from "@/lib/routes";
import { LeadChoices } from "./LeadChoices";
import { LeadDone } from "./LeadDone";
import { type LeadContact, type LeadIntent, useLeadSubmit } from "./useLeadSubmit";

type LeadFormProps = {
  id: string;
  intent: LeadIntent;
  /** inline — форма в разделе страницы («Хотите узнать больше?»): кнопка не во всю ширину. */
  variant?: "dialog" | "inline";
  /** После отправки: окно ставит «Закрыть» под ответом. */
  afterDone?: ReactNode;
};

const LANGS = ["ru", "uz"] as const;

/** Форма заявки мокапа (`.form`): имя и телефон, просмотр — что и когда, язык, согласие (ТЗ 10.2). */
export function LeadForm({ id, intent, variant = "dialog", afterDone }: LeadFormProps) {
  const t = useTranslations("lead");
  const locale = useLocale() as SiteLang;
  const [contact, setContact] = useState<LeadContact>({ name: "", phone: "", lang: locale, trap: "" });
  // «Этот ЖК» — когда заявка о ЖК (страница ЖК, карточка каталога); «О нас» и прочие без ЖК — без него.
  const hasComplex = Boolean(intent.object?.complex || intent.object?.layout || intent.object?.unit);
  const targets: readonly ViewTarget[] = hasComplex ? VIEW_TARGETS : VIEW_TARGETS.filter((target) => target !== "complex");
  const [view, setView] = useState<ViewChoice>({ target: intent.viewTarget ?? targets[0]!, day: "tomorrow", time: null });
  const { submit, fields, edited, error, sent, pending } = useLeadSubmit(id, intent);
  const done = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (sent) done.current?.focus();
  }, [sent]);

  if (sent) {
    return (
      <>
        <LeadDone ref={done} type={intent.type} number={sent.number} repeat={sent.repeat} />
        {afterDone}
      </>
    );
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit(contact, intent.type === "view" ? view : null);
  };
  return (
    <form className={`lead-form lead-form--${variant}`} noValidate onSubmit={onSubmit} aria-busy={pending}>
      <ContactFields id={id} contact={contact} onChange={setContact} onEdit={edited} errors={fields} />
      {intent.type === "view" ? <ViewFields id={id} view={view} targets={targets} onChange={setView} /> : null}
      <LeadChoices
        name={`${id}-lang`}
        legend={t("lang")}
        options={LANGS.map((value) => ({ value, label: t(`langs.${value}`) }))}
        value={contact.lang}
        onChange={(lang) => setContact({ ...contact, lang: lang ?? locale })}
      />
      {error ? <FormStatus tone="error">{t(`errors.${error}`)}</FormStatus> : null}
      <Button type="submit" block={variant === "dialog"} pending={pending} className="lead-form__submit">
        <Send size={16} aria-hidden="true" />
        {pending ? t("sending") : t("send")}
      </Button>
      <LeadConsent />
    </form>
  );
}

/** Фраза согласия под кнопкой (ТЗ 10.2) со ссылкой на /privacy; галочка — если скажет юрист. */
export function LeadConsent() {
  const t = useTranslations("lead");
  return (
    <p className="lead-form__consent">
      {t.rich("consent", {
        privacy: (chunks) => (
          <Link href={ROUTES.privacy} className="lead-form__privacy" target="_blank">
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}

type ContactFieldsProps = {
  id: string;
  contact: LeadContact;
  onChange: (contact: LeadContact) => void;
  /** Правка поля снимает его ошибку. */
  onEdit: (field: LeadField) => void;
  errors: LeadFieldErrors;
};

/** Имя и телефон рядом (`.form__two`, на телефоне — столбиком) и скрытая ловушка для ботов; квиз (3.17) собирает контакты ими же. */
export function ContactFields({ id, contact, onChange, onEdit, errors }: ContactFieldsProps) {
  const t = useTranslations("lead");
  const phoneError =
    errors.phone === "required" ? t("fieldErrors.phoneRequired") : errors.phone ? t("fieldErrors.phone") : undefined;
  return (
    <div className="lead-form__two">
      <Field
        id={`${id}-name`}
        label={t("name")}
        autoComplete="name"
        value={contact.name}
        error={errors.name ? t("fieldErrors.name") : undefined}
        onChange={(event) => {
          onEdit("name");
          onChange({ ...contact, name: event.target.value });
        }}
      />
      <Field
        id={`${id}-phone`}
        label={t("phone")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={t("phonePlaceholder")}
        value={contact.phone}
        error={phoneError}
        onFocus={() => {
          if (!contact.phone) onChange({ ...contact, phone: "+998 " });
        }}
        onChange={(event) => {
          onEdit("phone");
          onChange({ ...contact, phone: maskPhone(event.target.value) });
        }}
      />
      <TrapField value={contact.trap} onChange={(trap) => onChange({ ...contact, trap })} />
    </div>
  );
}

/** Ловушка для ботов (ТЗ 10.2): человек её не видит, диктор не читает, с клавиатуры в неё не попасть. */
export function TrapField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("lead");
  return (
    <input
      className="lead-form__trap"
      name="website"
      tabIndex={-1}
      aria-hidden="true"
      autoComplete="off"
      aria-label={t("trap")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

type ViewFieldsProps = {
  id: string;
  view: ViewChoice;
  targets: readonly ViewTarget[];
  onChange: (view: ViewChoice) => void;
};

/** «Записаться на просмотр» (ТЗ 10.1): что посмотреть, удобный день и — по желанию — время. */
function ViewFields({ id, view, targets, onChange }: ViewFieldsProps) {
  const t = useTranslations("lead");
  return (
    <>
      <LeadChoices
        name={`${id}-target`}
        legend={t("what")}
        options={targets.map((value) => ({ value, label: t(`targets.${value}`) }))}
        value={view.target}
        onChange={(target) => onChange({ ...view, target: target ?? view.target })}
      />
      <LeadChoices
        name={`${id}-day`}
        legend={t("day")}
        options={VIEW_DAYS.map((value) => ({ value, label: t(`days.${value}`) }))}
        value={view.day}
        onChange={(day) => onChange({ ...view, day: day ?? view.day })}
      />
      <LeadChoices
        name={`${id}-time`}
        legend={t("time")}
        options={VIEW_TIMES.map((value) => ({ value, label: t(`times.${value}`) }))}
        value={view.time}
        optional
        onChange={(time) => onChange({ ...view, time })}
      />
    </>
  );
}
