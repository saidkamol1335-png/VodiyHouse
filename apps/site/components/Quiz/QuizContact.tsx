"use client";

import { ArrowLeft, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/Button";
import { FormStatus } from "@/components/FormStatus";
import { ContactFields, LeadConsent, type LeadContact } from "@/components/LeadForm";
import type { useLeadSubmit } from "@/components/LeadForm";
import type { SiteLang } from "@/lib/leads/types";
import { QuizTitle, type QuizTitleLevel } from "./QuizTitle";

type QuizContactProps = {
  id: string;
  level: QuizTitleLevel;
  lang: SiteLang;
  labels: readonly string[];
  lead: ReturnType<typeof useLeadSubmit>;
  onBack: () => void;
};

/** Шаг 5 — контакты (мокап: «Куда прислать подборку?», бейджи ответов, имя и телефон, согласие ТЗ 10.2). */
export function QuizContact({ id, level, lang, labels, lead, onBack }: QuizContactProps) {
  const t = useTranslations("quiz");
  const tl = useTranslations("lead");
  const [contact, setContact] = useState<LeadContact>({ name: "", phone: "", lang, trap: "" });
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    lead.submit(contact, null);
  };
  return (
    <>
      <QuizTitle level={level}>{t("questions.contact")}</QuizTitle>
      {labels.length > 0 ? (
        <ul className="quiz__answers" aria-label={t("yourAnswers")}>
          {labels.map((label) => (
            <li key={label} className="quiz__answer">
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      <form className="lead-form lead-form--inline quiz__form" noValidate onSubmit={onSubmit} aria-busy={lead.pending}>
        <ContactFields id={id} contact={contact} onChange={setContact} onEdit={lead.edited} errors={lead.fields} />
        {lead.error ? <FormStatus tone="error">{tl(`errors.${lead.error}`)}</FormStatus> : null}
        <Button type="submit" block pending={lead.pending} className="quiz__submit">
          <Send size={16} aria-hidden="true" />
          {lead.pending ? tl("sending") : t("send")}
        </Button>
        <LeadConsent />
      </form>
      <div className="quiz__nav">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          {t("back")}
        </Button>
      </div>
    </>
  );
}
