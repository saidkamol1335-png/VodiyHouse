"use client";

import { Clock, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

export type CalcLeadRow = { label: string; value: string };

type CalcLeadProps = {
  id: string;
  /** «Ipoteka Bank · Рассрочка через банк · 39 617 000 сум/мес» — над полями, как «ЖК Shodlik». */
  context: string;
  /** Что попадёт в заявку: программа, стоимость, взнос, срок, платёж. */
  rows: readonly CalcLeadRow[];
};

type Contact = { name: string; phone: string };
type Errors = Partial<Record<keyof Contact, string>>;

const noSubscription = () => () => {};

/** +998 и 9 цифр; пробелы, скобки и дефисы — как набрали. */
export function phoneDigits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const full = digits.length === 9 ? `998${digits}` : digits;
  return /^998\d{9}$/.test(full) ? full : null;
}

/**
 * «Получить точный расчёт» (решение фазы 2, мокап MobLead): окно с контекстом расчёта, имя и
 * телефон. Отправка заявок — фаза 3; до неё кнопку видят только стенды, и окно показывает, что
 * соберётся в заявку.
 */
export function CalcLead({ id, context, rows }: CalcLeadProps) {
  const t = useTranslations("calc.lead");
  const dialog = useRef<HTMLDialogElement>(null);
  // Окно — в body, а не в итоге: тёмная панель итога на телефоне (Р9) переопределяет токены
  // цветов, и окно внутри неё наследовало бы прозрачный фон. На сервере document нет.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  const leadWindow = (
    <dialog ref={dialog} className="calc-lead" aria-labelledby={`${id}-title`}>
      <div className="calc-lead__head">
        <h2 id={`${id}-title`} className="calc-lead__title">
          {t("title")}
        </h2>
        <button
          type="button"
          className="calc-lead__close"
          aria-label={t("close")}
          onClick={() => dialog.current?.close()}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="calc-lead__context">{context}</p>
      <LeadForm id={id} rows={rows} />
    </dialog>
  );
  return (
    <>
      <Button block onClick={() => dialog.current?.showModal()}>
        {t("open")}
      </Button>
      {inBrowser ? createPortal(leadWindow, document.body) : null}
    </>
  );
}

function contactErrors(contact: Contact, t: (key: "required" | "phoneInvalid") => string): Errors {
  const errors: Errors = {};
  if (!contact.name.trim()) errors.name = t("required");
  if (!phoneDigits(contact.phone))
    errors.phone = contact.phone.trim() ? t("phoneInvalid") : t("required");
  return errors;
}

/** Имя и телефон: «Заполните» под пустым, телефон — +998 и 9 цифр; верно — что соберётся в заявку. */
function LeadForm({ id, rows }: { id: string; rows: readonly CalcLeadRow[] }) {
  const t = useTranslations("calc.lead");
  const [contact, setContact] = useState<Contact>({ name: "", phone: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [collected, setCollected] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next = contactErrors(contact, t);
    setErrors(next);
    setCollected(Object.keys(next).length === 0);
  };
  return (
    <>
      <form className="calc-lead__form" noValidate onSubmit={submit}>
        <Field
          id={`${id}-name`}
          label={t("name")}
          autoComplete="name"
          value={contact.name}
          error={errors.name}
          onChange={(event) => setContact({ ...contact, name: event.target.value })}
        />
        <Field
          id={`${id}-phone`}
          label={t("phone")}
          type="tel"
          autoComplete="tel"
          placeholder={t("phonePlaceholder")}
          value={contact.phone}
          error={errors.phone}
          onChange={(event) => setContact({ ...contact, phone: event.target.value })}
        />
        <Button type="submit" block>
          {t("submit")}
        </Button>
        <p className="calc-lead__note">{t("consent")}</p>
      </form>
      <p className="calc-lead__next">
        <Clock size={16} aria-hidden="true" />
        {t("next")}
      </p>
      {collected ? <Collected rows={rows} contact={contact} /> : null}
    </>
  );
}

function Collected({ rows, contact }: { rows: readonly CalcLeadRow[]; contact: Contact }) {
  const t = useTranslations("calc.lead");
  const all = [
    ...rows,
    { label: t("name"), value: contact.name.trim() },
    { label: t("phone"), value: `+${phoneDigits(contact.phone)}` },
  ];
  return (
    <section className="calc-lead__collected" role="status">
      <p className="calc-lead__stand">{t("stand")}</p>
      <dl className="calc-lead__rows">
        {all.map((row) => (
          <div key={row.label} className="calc-lead__row">
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
