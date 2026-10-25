"use client";

import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { submitLeadAction } from "@/lib/leads/actions";
import { fieldErrorsOf } from "@/lib/leads/request";
import { leadSource } from "@/lib/leads/source";
import type {
  LeadCalc,
  LeadErrorCode,
  LeadFieldErrors,
  LeadObject,
  LeadRequest,
  LeadSubmitResult,
  LeadType,
  SiteLang,
  ViewChoice,
} from "@/lib/leads/types";

/** С чем открыли форму: тип, объект и данные по типу (контекст для глаз — отдельно, в окне). */
export type LeadIntent = {
  type: LeadType;
  object?: LeadObject;
  /** «ЖК Shodlik · Блок A · 2-комн.» — плашка над полями (мокап `.ctx`); на сервер не уходит. */
  context?: string;
  /** Просмотр: что смотреть по умолчанию («О нас» — офис). */
  viewTarget?: ViewChoice["target"];
  filters?: LeadRequest["filters"];
  calc?: LeadCalc;
  calcRows?: LeadRequest["calcRows"];
};

export type LeadContact = { name: string; phone: string; lang: SiteLang; trap: string };

/** «Застройщикам» (3.11): компания обязательна, остальное — по желанию. */
export type LeadPartner = NonNullable<LeadRequest["partner"]>;

export type LeadSent = { number: number; repeat: boolean };

const NETWORK: LeadSubmitResult = { status: "error", error: "network" };

/** Проверка как на сервере → отправка → «отправлено» или ошибка; ошибки полей — фокус на первое. */
export function useLeadSubmit(id: string, intent: LeadIntent) {
  const locale = useLocale() as SiteLang;
  const [fields, setFields] = useState<LeadFieldErrors>({});
  const [error, setError] = useState<LeadErrorCode | null>(null);
  const [sent, setSent] = useState<LeadSent | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (contact: LeadContact, view: ViewChoice | null, partner?: LeadPartner) => {
    const invalid = fieldErrorsOf({ ...contact, company: partner?.company }, Boolean(partner));
    setFields(invalid);
    setError(null);
    const first = (["company", "name", "phone"] as const).find((key) => invalid[key]);
    if (first) {
      document.getElementById(`${id}-${first}`)?.focus();
      return;
    }
    const request: LeadRequest = {
      type: intent.type,
      name: contact.name,
      phone: contact.phone,
      contactLang: contact.lang,
      siteLang: locale,
      object: intent.object ?? {},
      pageUrl: `${window.location.pathname}${window.location.search}`,
      source: leadSource(),
      ...(view ? { view } : {}),
      ...(partner ? { partner } : {}),
      ...(intent.filters ? { filters: intent.filters } : {}),
      ...(intent.calc ? { calc: intent.calc, calcRows: intent.calcRows } : {}),
      trap: contact.trap,
    };
    startTransition(async () => {
      const result = await submitLeadAction(request).catch(() => NETWORK);
      if (result.status === "sent") setSent({ number: result.number, repeat: result.repeat });
      else {
        setError(result.error);
        setFields(result.fields ?? {});
      }
    });
  };
  return { submit, fields, error, sent, pending };
}
